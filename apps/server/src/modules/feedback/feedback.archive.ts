import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buffer } from "node:stream/consumers";
import { formatFeedbackNumber } from "@skerp/types";

import { db } from "../../../prisma/prisma.js";
import { getObjectStream, isS3Configured } from "../../lib/s3.js";
import {
  buildFeedbackDocx,
  imageSize,
  type DocxImage,
} from "./feedback.docx.js";
import { buildFeedbackXlsx } from "./feedback.export.js";
import {
  ATTACHMENT_ENTITY,
  findScreenshots,
  findVoiceNotes,
} from "./feedback.service.js";

/**
 * B9 step 1 — archive ALL feedback before it is switched off and removed.
 *
 *   cd apps/server
 *   pnpm exec tsx src/modules/feedback/feedback.archive.ts [output folder]
 *
 * Writes skerp-feedback-archive-YYYY-MM-DD/ into the output folder (default:
 * the current folder):
 *   feedback.xlsx           every item, no row limit (same layout as the export)
 *   feedback-report-N.docx  Word report, 300 items per file, pictures embedded
 *   feedback.json           every field and the whole conversation (lossless)
 *   attachments/            every clean file the reporters attached, FB-0042-1.png
 *   README.txt              what is where, and the counts
 *
 * Read-only: it never changes the database or S3, and works with
 * FEEDBACK_ENABLED off because it reads the tables directly. Run it where
 * AWS_S3_BUCKET is set, or the attached files are listed but not saved.
 */

const DOCX_BATCH = 300;
const DOCX_IMAGE_BYTES = 40 * 1024 * 1024;

type SavedFile = {
  feedbackId: string;
  file: string;
  bytes: number;
  originalName: string;
};

async function main() {
  const generatedAt = new Date();
  const stamp = generatedAt.toISOString().slice(0, 10);
  const outDir = path.resolve(
    process.argv[2] ?? ".",
    `skerp-feedback-archive-${stamp}`,
  );
  const filesDir = path.join(outDir, "attachments");
  await mkdir(filesDir, { recursive: true });

  const webUrl = process.env.WEB_URL;
  const rows = await db.feedback.findMany({
    orderBy: { number: "asc" },
    include: { comments: { orderBy: { createdAt: "asc" } } },
  });
  const numberById = new Map(
    rows.map((row) => [row.id, formatFeedbackNumber(row.number)]),
  );

  /* ---- Attached files: saved once, then reused by the Word reports ---- */
  const attachmentCount = await db.attachment.count({
    where: {
      entityType: ATTACHMENT_ENTITY,
      uploaded: true,
      deletedAt: null,
      antivirusStatus: "CLEAN",
    },
  });
  const saved: SavedFile[] = [];
  /*
   * Voice notes go in the zip but never into `saved`: that list is what the
   * Word reports try to embed as images, and an audio file there would be
   * read, rejected by imageSize() and reported as a skipped picture.
   */
  const savedVoice: SavedFile[] = [];
  const failed: string[] = [];
  if (rows.length > 0 && isS3Configured()) {
    const ids = rows.map((row) => row.id);
    const download = async (
      attachments: Awaited<ReturnType<typeof findScreenshots>>,
      suffix: string,
      into: SavedFile[],
    ) => {
      const perItem = new Map<string, number>();
      for (const shot of attachments) {
        const index = (perItem.get(shot.entityId) ?? 0) + 1;
        perItem.set(shot.entityId, index);
        const file = `${numberById.get(shot.entityId)}-${suffix}${index}${path.extname(shot.originalName) || ".bin"}`;
        try {
          const data = await buffer(await getObjectStream(shot.s3Key));
          await writeFile(path.join(filesDir, file), data);
          into.push({
            feedbackId: shot.entityId,
            file,
            bytes: data.length,
            originalName: shot.originalName,
          });
        } catch (error) {
          failed.push(`${file} (${shot.s3Key})`);
          console.error(
            `[feedback-archive] could not download ${shot.s3Key}:`,
            error,
          );
        }
      }
    };
    await download(await findScreenshots(ids), "", saved);
    await download(await findVoiceNotes(ids), "voice-", savedVoice);
  }
  const allSaved = [...saved, ...savedVoice];
  const byItem = (entries: SavedFile[]) => {
    const map = new Map<string, SavedFile[]>();
    for (const entry of entries) {
      map.set(entry.feedbackId, [...(map.get(entry.feedbackId) ?? []), entry]);
    }
    return map;
  };
  /** Every attached file, listed in feedback.json. */
  const savedByItem = byItem(allSaved);
  /** Pictures only — the Word reports embed these. */
  const picturesByItem = byItem(saved);

  /* ---- Excel: every item ---- */
  await writeFile(
    path.join(outDir, "feedback.xlsx"),
    await buildFeedbackXlsx(rows, { generatedAt, webUrl }),
  );

  /* ---- Word: 300 items per file so each stays openable ---- */
  let reports = 0;
  let skippedImages = 0;
  for (let start = 0; start < rows.length; start += DOCX_BATCH) {
    const batch = rows.slice(start, start + DOCX_BATCH);
    const images = new Map<string, DocxImage[]>();
    let usedBytes = 0;
    let skipped = 0;
    for (const row of batch) {
      for (const entry of picturesByItem.get(row.id) ?? []) {
        const data = await readFile(path.join(filesDir, entry.file));
        const size = imageSize(data);
        if (!size || usedBytes + data.length > DOCX_IMAGE_BYTES) {
          skipped += 1;
          continue;
        }
        usedBytes += data.length;
        images.set(row.id, [...(images.get(row.id) ?? []), { data, ...size }]);
      }
    }
    skippedImages += skipped;
    reports += 1;
    const range = `${formatFeedbackNumber(batch[0]!.number)} to ${formatFeedbackNumber(batch.at(-1)!.number)}`;
    await writeFile(
      path.join(outDir, `feedback-report-${reports}.docx`),
      await buildFeedbackDocx(batch, images, {
        generatedAt,
        filters: `Archive part ${reports}: ${range}`,
        webUrl,
        skippedImages: skipped,
      }),
    );
  }

  /* ---- JSON: lossless copy of every field ---- */
  await writeFile(
    path.join(outDir, "feedback.json"),
    JSON.stringify(
      {
        generatedAt,
        items: rows.map((row) => ({
          fbNumber: numberById.get(row.id),
          ...row,
          attachments: (savedByItem.get(row.id) ?? []).map(
            ({ file, originalName, bytes }) => ({
              file: `attachments/${file}`,
              originalName,
              bytes,
            }),
          ),
        })),
      },
      null,
      2,
    ),
  );

  const comments = rows.reduce((sum, row) => sum + row.comments.length, 0);
  const lines = [
    "SK ERP — in-app feedback archive (testing phase)",
    `Generated: ${generatedAt.toISOString()}`,
    "",
    `Items:         ${rows.length}${rows.length ? ` (${formatFeedbackNumber(rows[0]!.number)} to ${formatFeedbackNumber(rows.at(-1)!.number)})` : ""}`,
    `Comments:      ${comments}`,
    `Attachments:   ${allSaved.length} saved of ${attachmentCount} clean uploads`,
    `               ${saved.length} picture(s), ${savedVoice.length} voice note(s)`,
    ...(isS3Configured()
      ? []
      : [
          "               (AWS_S3_BUCKET not set here, so no files were downloaded — run again where it is set)",
        ]),
    ...(failed.length ? [`Not saved:     ${failed.join(", ")}`] : []),
    `Word reports:  ${reports}${skippedImages ? ` (${skippedImages} picture(s) left out of the Word files; all are in attachments/)` : ""}`,
    "",
    "feedback.xlsx           every item, one row each, plus By page and By status sheets",
    "feedback-report-N.docx  developer report grouped by module and page, 300 items per file",
    "feedback.json           every stored field and the full conversation",
    "attachments/            the files reporters attached, named after the item",
    "                        pictures FB-0042-1.png, voice notes FB-0042-voice-1.webm",
  ];
  await writeFile(path.join(outDir, "README.txt"), `${lines.join("\n")}\n`);

  console.log(lines.slice(3, lines.indexOf("", 3)).join("\n"));
  console.log(`\nfeedback-archive: written to ${outDir}`);
  if (
    failed.length > 0 ||
    (attachmentCount > 0 && allSaved.length < attachmentCount)
  ) {
    console.warn(
      "feedback-archive: some attached files were not saved — see README.txt before removing S3 data.",
    );
  }
}

main()
  .catch((error) => {
    console.error("feedback-archive failed:", error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
