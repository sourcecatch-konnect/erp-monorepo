import {
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_SEVERITY_LABELS,
  FEEDBACK_STATUSES,
  FEEDBACK_STATUS_LABELS,
} from "@skerp/validators";
import {
  describeUserAgent,
  formatFeedbackNumber,
  type FeedbackContext,
} from "@skerp/types";

import {
  asRecord,
  describeApiErrors,
  describeDetails,
  fmtDateTime,
  type FeedbackExportRow,
} from "./feedback.export.js";

/**
 * B7 — developer report: Module → Page → item, with the reporter's answers,
 * embedded screenshots, technical details, team notes and the conversation.
 */

export type DocxComment = {
  authorName: string;
  side: "REPORTER" | "TEAM";
  body: string;
  createdAt: Date;
};

export type DocxRow = FeedbackExportRow & { comments: DocxComment[] };

export type DocxImage = {
  data: Buffer;
  type: "jpg" | "png";
  width: number;
  height: number;
};

const MUTED = "6B6259";
const MAX_IMAGE_WIDTH = 600;

/** Reads pixel size from a PNG or JPEG header. */
export function imageSize(data: Buffer): { width: number; height: number; type: "jpg" | "png" } | null {
  // PNG: signature, then IHDR width/height at bytes 16–23.
  if (data.length > 24 && data.readUInt32BE(0) === 0x89504e47) {
    return { type: "png", width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  }
  // JPEG: walk segments until a Start-Of-Frame marker.
  if (data.length > 4 && data[0] === 0xff && data[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < data.length) {
      if (data[offset] !== 0xff) return null;
      const marker = data[offset + 1]!;
      const length = data.readUInt16BE(offset + 2);
      const isSof =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) {
        return {
          type: "jpg",
          height: data.readUInt16BE(offset + 5),
          width: data.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + length;
    }
  }
  return null;
}

/** Multi-line text as runs with line breaks. */
const lines = (text: string, options: { bold?: boolean; color?: string; size?: number } = {}) =>
  text.split(/\r?\n/).map(
    (line, index) =>
      new TextRun({ text: line, break: index > 0 ? 1 : 0, ...options }),
  );

const labelled = (label: string, value: string) =>
  new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text: `${label}: `, bold: true }), ...lines(value)],
  });

const small = (text: string) =>
  new Paragraph({
    spacing: { after: 80 },
    children: lines(text, { color: MUTED, size: 18 }),
  });

const heading = (text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) =>
  new Paragraph({ heading: level, spacing: { before: 240, after: 120 }, children: [new TextRun(text)] });

function itemParagraphs(row: DocxRow, images: DocxImage[], webUrl?: string): Paragraph[] {
  const context = asRecord(row.context) as FeedbackContext;
  const out: Paragraph[] = [];

  const tags = [
    formatFeedbackNumber(row.number),
    FEEDBACK_CATEGORY_LABELS[row.category],
    row.severity ? FEEDBACK_SEVERITY_LABELS[row.severity] : null,
    FEEDBACK_STATUS_LABELS[row.status],
  ].filter(Boolean);
  out.push(heading(`${tags.join(" · ")} — ${row.title}`, HeadingLevel.HEADING_3));
  out.push(
    small(
      `Reported by ${row.reporterName} (${row.reporterRole}${
        row.reporterBranch ? `, ${row.reporterBranch}` : ""
      }) on ${fmtDateTime(row.createdAt)} · ${row.pagePath}${
        row.entityId ? ` · record ${row.entityId}` : ""
      }`,
    ),
  );

  const details = describeDetails(row.category, row.details);
  for (const line of details.split("\n").filter(Boolean)) {
    const [label, ...rest] = line.split(": ");
    out.push(labelled(label ?? "", rest.join(": ")));
  }
  if (row.description) out.push(labelled("Anything else", row.description));

  for (const image of images) {
    const scale = Math.min(1, MAX_IMAGE_WIDTH / image.width);
    out.push(
      new Paragraph({
        spacing: { before: 120, after: 120 },
        children: [
          new ImageRun({
            type: image.type,
            data: image.data,
            transformation: {
              width: Math.round(image.width * scale),
              height: Math.round(image.height * scale),
            },
          }),
        ],
      }),
    );
  }

  out.push(
    small(
      `${describeUserAgent(context.userAgent)} · app version ${context.appVersion ?? "not set"} · screen ${
        context.viewport ?? "?"
      }`,
    ),
  );
  const apiErrors = describeApiErrors(context);
  if (apiErrors) out.push(labelled("Recent API errors", apiErrors));
  if (context.element) {
    out.push(
      labelled(
        "Pointed at",
        `${context.element.text ? `"${context.element.text}" — ` : ""}${context.element.selector}`,
      ),
    );
  }

  const notes = [
    row.assignee ? `Assigned to ${row.assignee}` : null,
    row.externalRef ? `Jira ${row.externalRef}` : null,
    row.reporterConfirmedAt ? `Tester confirmed the fix on ${fmtDateTime(row.reporterConfirmedAt)}` : null,
  ].filter(Boolean);
  if (notes.length > 0) out.push(labelled("Team", notes.join(" · ")));
  if (row.devNotes) out.push(labelled("Developer notes", row.devNotes));

  if (row.comments.length > 0) {
    out.push(new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: "Conversation", bold: true })] }));
    for (const comment of row.comments) {
      out.push(
        new Paragraph({
          spacing: { after: 60 },
          children: [
            new TextRun({
              text: `${comment.authorName} (${comment.side === "TEAM" ? "team" : "tester"}), ${fmtDateTime(comment.createdAt)}: `,
              color: MUTED,
              size: 18,
            }),
            ...lines(comment.body, { size: 20 }),
          ],
        }),
      );
    }
  }

  if (webUrl) out.push(small(`Open in the ERP: ${webUrl}/settings/feedback?id=${row.id}`));
  return out;
}

export async function buildFeedbackDocx(
  rows: DocxRow[],
  images: Map<string, DocxImage[]>,
  meta: { generatedAt: Date; filters: string; webUrl?: string; skippedImages: number },
): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun("SK ERP — Feedback report")] }),
    small(`Generated ${fmtDateTime(meta.generatedAt)} · ${rows.length} item${rows.length === 1 ? "" : "s"} · ${meta.filters}`),
    labelled(
      "By type",
      FEEDBACK_CATEGORIES.map(
        (c) => `${FEEDBACK_CATEGORY_LABELS[c]} ${rows.filter((r) => r.category === c).length}`,
      ).join(" · "),
    ),
    labelled(
      "By status",
      FEEDBACK_STATUSES.map(
        (s) => `${FEEDBACK_STATUS_LABELS[s]} ${rows.filter((r) => r.status === s).length}`,
      ).join(" · "),
    ),
  ];
  if (meta.skippedImages > 0) {
    children.push(
      small(`${meta.skippedImages} picture(s) were left out to keep the file small. Open the item in the ERP to see them.`),
    );
  }

  const byModule = new Map<string, Map<string, DocxRow[]>>();
  for (const row of rows) {
    const pages = byModule.get(row.moduleLabel) ?? new Map<string, DocxRow[]>();
    pages.set(row.pageTitle, [...(pages.get(row.pageTitle) ?? []), row]);
    byModule.set(row.moduleLabel, pages);
  }

  for (const [module, pages] of [...byModule].sort(([a], [b]) => a.localeCompare(b))) {
    children.push(heading(module, HeadingLevel.HEADING_1));
    for (const [page, items] of [...pages].sort(([a], [b]) => a.localeCompare(b))) {
      children.push(heading(`${page} (${items.length})`, HeadingLevel.HEADING_2));
      for (const row of items) {
        children.push(...itemParagraphs(row, images.get(row.id) ?? [], meta.webUrl));
      }
    }
  }

  const doc = new Document({
    creator: "SK ERP",
    title: "Feedback report",
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [{ children }],
  });
  return Packer.toBuffer(doc);
}
