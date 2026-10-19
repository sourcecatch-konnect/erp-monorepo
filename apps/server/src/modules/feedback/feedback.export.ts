import ExcelJS from "exceljs";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_DETAIL_FIELDS,
  FEEDBACK_SEVERITY_LABELS,
  FEEDBACK_STATUSES,
  FEEDBACK_STATUS_LABELS,
} from "@skerp/validators";
import {
  describeUserAgent,
  formatFeedbackNumber,
  type FeedbackCategory,
  type FeedbackContext,
  type FeedbackSeverity,
  type FeedbackStatus,
} from "@skerp/types";

/**
 * Excel export for developers / test leads (B5). Three sheets:
 *   Feedback  — one row per item, filters applied
 *   By page   — open/total counts per page, most reported first
 *   By status — category × status counts
 */

export type FeedbackExportRow = {
  id: string;
  number: number;
  category: FeedbackCategory;
  title: string;
  description: string | null;
  details: unknown;
  severity: FeedbackSeverity | null;
  status: FeedbackStatus;
  pagePath: string;
  pageTitle: string;
  moduleLabel: string;
  entityId: string | null;
  context: unknown;
  reporterName: string;
  reporterRole: string;
  reporterBranch: string | null;
  assignee: string | null;
  devNotes: string | null;
  externalRef: string | null;
  createdAt: Date;
};

const OPEN: readonly FeedbackStatus[] = ["NEW", "TRIAGED", "IN_PROGRESS"];

const fmtDateTime = (date: Date): string =>
  new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

/** "What they were doing: …" lines, labels and choice values made readable. */
export const describeDetails = (
  category: FeedbackCategory,
  details: unknown,
): string => {
  const answers = asRecord(details);
  const lines: string[] = [];
  for (const field of FEEDBACK_DETAIL_FIELDS[category]) {
    const raw = answers[field.key];
    if (typeof raw !== "string" || raw === "") continue;
    const choices: Record<string, string> | undefined =
      "choices" in field ? field.choices : undefined;
    lines.push(`${field.label}: ${choices?.[raw] ?? raw}`);
  }
  return lines.join("\n");
};

const describeApiErrors = (context: FeedbackContext): string =>
  (context.recentApi ?? [])
    .filter((call) => call.status === null || call.status >= 400)
    .map(
      (call) =>
        `${call.method} ${call.url} → ${call.status ?? "no response"}${
          call.message ? ` ${call.message}` : ""
        }`,
    )
    .join("\n");

const styleHeader = (sheet: ExcelJS.Worksheet, columnCount: number) => {
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF0ECE4" },
  };
  header.alignment = { vertical: "middle" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columnCount },
  };
};

export async function buildFeedbackXlsx(
  rows: FeedbackExportRow[],
  meta: { generatedAt: Date; webUrl?: string },
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SK ERP";
  wb.created = meta.generatedAt;

  /* ---- Sheet 1: every item ---- */
  const sheet = wb.addWorksheet("Feedback");
  sheet.columns = [
    { header: "FB #", key: "number", width: 10 },
    { header: "Reported on", key: "createdAt", width: 20 },
    { header: "Type", key: "category", width: 14 },
    { header: "Severity", key: "severity", width: 10 },
    { header: "Status", key: "status", width: 13 },
    { header: "Title", key: "title", width: 40 },
    { header: "Module", key: "moduleLabel", width: 28 },
    { header: "Page", key: "pageTitle", width: 24 },
    { header: "Page address", key: "pagePath", width: 32 },
    { header: "Record ID", key: "entityId", width: 16 },
    { header: "Details", key: "details", width: 60 },
    { header: "Anything else", key: "description", width: 40 },
    { header: "Reported by", key: "reporterName", width: 22 },
    { header: "Role", key: "reporterRole", width: 18 },
    { header: "Branch", key: "reporterBranch", width: 16 },
    { header: "Assigned to", key: "assignee", width: 18 },
    { header: "Jira key", key: "externalRef", width: 12 },
    { header: "Developer notes", key: "devNotes", width: 40 },
    { header: "App version", key: "appVersion", width: 14 },
    { header: "Browser", key: "browser", width: 22 },
    { header: "Recent API errors", key: "apiErrors", width: 50 },
    { header: "Link", key: "link", width: 40 },
  ];

  for (const row of rows) {
    const context = asRecord(row.context) as FeedbackContext;
    const excelRow = sheet.addRow({
      number: formatFeedbackNumber(row.number),
      createdAt: fmtDateTime(row.createdAt),
      category: FEEDBACK_CATEGORY_LABELS[row.category],
      severity: row.severity ? FEEDBACK_SEVERITY_LABELS[row.severity] : "",
      status: FEEDBACK_STATUS_LABELS[row.status],
      title: row.title,
      moduleLabel: row.moduleLabel,
      pageTitle: row.pageTitle,
      pagePath: row.pagePath,
      entityId: row.entityId ?? "",
      details: describeDetails(row.category, row.details),
      description: row.description ?? "",
      reporterName: row.reporterName,
      reporterRole: row.reporterRole,
      reporterBranch: row.reporterBranch ?? "",
      assignee: row.assignee ?? "",
      externalRef: row.externalRef ?? "",
      devNotes: row.devNotes ?? "",
      appVersion: context.appVersion ?? "",
      browser: describeUserAgent(context.userAgent),
      apiErrors: describeApiErrors(context),
      link: meta.webUrl ? `${meta.webUrl}/settings/feedback?id=${row.id}` : "",
    });
    excelRow.alignment = { vertical: "top", wrapText: true };
  }
  styleHeader(sheet, sheet.columns.length);

  /* ---- Sheet 2: by page ---- */
  const byPage = wb.addWorksheet("By page");
  byPage.columns = [
    { header: "Module", key: "module", width: 30 },
    { header: "Page", key: "page", width: 26 },
    { header: "Open", key: "open", width: 8 },
    ...FEEDBACK_CATEGORIES.map((category) => ({
      header: FEEDBACK_CATEGORY_LABELS[category],
      key: category,
      width: 13,
    })),
    { header: "Total", key: "total", width: 8 },
  ];
  type PageCounts = Record<FeedbackCategory, number> & {
    module: string;
    page: string;
    open: number;
    total: number;
  };
  const pages = new Map<string, PageCounts>();
  for (const row of rows) {
    const key = `${row.moduleLabel}\u0000${row.pageTitle}`;
    const counts =
      pages.get(key) ??
      ({
        module: row.moduleLabel,
        page: row.pageTitle,
        open: 0,
        total: 0,
        ...Object.fromEntries(FEEDBACK_CATEGORIES.map((c) => [c, 0])),
      } as PageCounts);
    counts[row.category] += 1;
    counts.total += 1;
    if (OPEN.includes(row.status)) counts.open += 1;
    pages.set(key, counts);
  }
  [...pages.values()]
    .sort((a, b) => b.open - a.open || b.total - a.total)
    .forEach((counts) => byPage.addRow(counts));
  styleHeader(byPage, byPage.columns.length);

  /* ---- Sheet 3: category × status ---- */
  const byStatus = wb.addWorksheet("By status");
  byStatus.columns = [
    { header: "Type", key: "category", width: 16 },
    ...FEEDBACK_STATUSES.map((status) => ({
      header: FEEDBACK_STATUS_LABELS[status],
      key: status,
      width: 13,
    })),
    { header: "Total", key: "total", width: 8 },
  ];
  for (const category of FEEDBACK_CATEGORIES) {
    const ofCategory = rows.filter((row) => row.category === category);
    byStatus.addRow({
      category: FEEDBACK_CATEGORY_LABELS[category],
      ...Object.fromEntries(
        FEEDBACK_STATUSES.map((status) => [
          status,
          ofCategory.filter((row) => row.status === status).length,
        ]),
      ),
      total: ofCategory.length,
    });
  }
  styleHeader(byStatus, byStatus.columns.length);

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
