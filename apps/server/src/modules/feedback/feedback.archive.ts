import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buffer } from "node:stream/consumers";
import { feedbackFileKind, formatFeedbackNumber } from "@skerp/types";

import { db } from "../../../prisma/prisma.js";
import { getObjectStream, isS3Configured } from "../../lib/s3.js";
import { buildFeedbackDocx, imageSize, type DocxImage } from "./feedback.docx.js";
import { buildFeedbackXlsx, type ExportFile } from "./feedback.export.js";
import { ATTACHMENT_ENTITY, findFeedbackFiles } from "./feedback.service.js";

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
 *   attachments/            every clean file the reporters attached (pictures,
 *                           documents, voice notes), FB-0042-1.jpg, FB-0042-2.webm
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
  mime: string;
};

async function main() {
  const generatedAt = new Date();
  const stamp = generatedAt.toISOString().slice(0, 10);
  const outDir = path.resolve(process.argv[2] ?? ".", `skerp-feedback-archive-${stamp}`);
  const filesDir = path.join(outDir, "attachments");
  await mkdir(filesDir, { recursive: true });

  const webUrl = process.env.WEB_URL;
  const rows = await db.feedback.findMany({
    orderBy: { number: "asc" },
    include: { comments: { orderBy: { createdAt: "asc" } } },
  });
  const numberById = new Map(rows.map((row) => [row.id, formatFeedbackNumber(row.number)]));

  /* ---- Attached files: saved once, then reused by the Word reports ---- */
  const attachmentCount = await db.attachment.count({
    where: { entityType: ATTACHMENT_ENTITY, uploaded: true, deletedAt: null, antivirusStatus: "CLEAN" },
  });
  const storedFiles = rows.length > 0 ? await findFeedbackFiles(rows.map((row) => row.id)) : [];
  const exportFiles = new Map<string, ExportFile[]>();
  for (const stored of storedFiles) {
    exportFiles.set(stored.entityId, [
      ...(exportFiles.get(stored.entityId) ?? []),
      { kind: feedbackFileKind(stored.mime), name: stored.originalName },
    ]);
  }
  const saved: SavedFile[] = [];
  const failed: string[] = [];
  if (isS3Configured()) {
    const perItem = new Map<string, number>();
    for (const stored of storedFiles) {
      const index = (perItem.get(stored.entityId) ?? 0) + 1;
      perItem.set(stored.entityId, index);
      const file = `${numberById.get(stored.entityId)}-${index}${path.extname(stored.originalName) || ".bin"}`;
      try {
        const data = await buffer(await getObjectStream(stored.s3Key));
        await writeFile(path.join(filesDir, file), data);
        saved.push({
          feedbackId: stored.entityId,
          file,
          bytes: data.length,
          originalName: stored.originalName,
          mime: stored.mime,
        });
      } catch (error) {
        failed.push(`${file} (${stored.s3Key})`);
        console.error(`[feedback-archive] could not download ${stored.s3Key}:`, error);
      }
    }
  }
  const savedByItem = new Map<string, SavedFile[]>();
  for (const entry of saved) {
    savedByItem.set(entry.feedbackId, [...(savedByItem.get(entry.feedbackId) ?? []), entry]);
  }

  /* ---- Excel: every item ---- */
  await writeFile(
    path.join(outDir, "feedback.xlsx"),
    await buildFeedbackXlsx(rows, { generatedAt, webUrl, files: exportFiles }),
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
      for (const entry of savedByItem.get(row.id) ?? []) {
        if (feedbackFileKind(entry.mime) !== "image") continue;
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
        files: exportFiles,
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
          attachments: (savedByItem.get(row.id) ?? []).map(({ file, originalName, bytes }) => ({
            file: `attachments/${file}`,
            originalName,
            bytes,
          })),
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
    `Attachments:   ${saved.length} saved of ${attachmentCount} clean uploads`,
    ...(isS3Configured()
      ? []
      : ["               (AWS_S3_BUCKET not set here, so no files were downloaded — run again where it is set)"]),
    ...(failed.length ? [`Not saved:     ${failed.join(", ")}`] : []),
    `Word reports:  ${reports}${skippedImages ? ` (${skippedImages} picture(s) left out of the Word files; all are in attachments/)` : ""}`,
    "",
    "feedback.xlsx           every item, one row each, plus By page and By status sheets",
    "feedback-report-N.docx  developer report grouped by module and page, 300 items per file",
    "feedback.json           every stored field and the full conversation",
    "attachments/            the pictures, documents and voice notes reporters attached, named after the item (FB-0042-1.jpg)",
  ];
  await writeFile(path.join(outDir, "README.txt"), `${lines.join("\n")}\n`);

  console.log(lines.slice(3, lines.indexOf("", 3)).join("\n"));
  console.log(`\nfeedback-archive: written to ${outDir}`);
  if (failed.length > 0 || (attachmentCount > 0 && saved.length < attachmentCount)) {
    console.warn("feedback-archive: some attached files were not saved — see README.txt before removing S3 data.");
  }
}

main()
  .catch((error) => {
    console.error("feedback-archive failed:", error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
