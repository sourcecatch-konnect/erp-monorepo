import { describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import { feedbackFormSchema, feedbackSubmitSchema } from "@skerp/validators";

vi.mock("../../../../prisma/prisma.js", () => ({ db: {} }));

import { buildFeedbackDocx, type DocxRow } from "../feedback.docx.js";
import { buildFeedbackXlsx } from "../feedback.export.js";
import {
  OPEN_STATUSES,
  buildFeedbackWhere,
  isResolved,
  pickDetails,
  statusChangeText,
  takeSubmitSlot,
} from "../feedback.service.js";
import type { ListQuery } from "../../_shared/list.query.js";

const page = { path: "/vp-management/vp-loading", title: "VP Loading", module: "Operations › VP Management" };

const VALID = {
  BUG: {
    category: "BUG",
    title: "Save button does nothing",
    steps: "Filled the form and pressed Save",
    expected: "The loading is saved",
    actual: "Nothing happens",
    severity: "MAJOR",
  },
  FLOW: {
    category: "FLOW",
    title: "Approval step is in the wrong place",
    step: "Approve order",
    currentBehaviour: "Operations can approve",
    correctProcess: "Only the branch manager approves",
  },
  UI: {
    category: "UI",
    title: "Label is confusing",
    element: "Consignee field",
    problem: "CONFUSING_NAME",
    suggestion: "Call it Receiver",
  },
  FINDABILITY: {
    category: "FINDABILITY",
    title: "Cannot find the POD upload",
    lookingFor: "Where to upload the POD",
    lookedWhere: "LR list",
    found: "NO",
  },
  SUGGESTION: { category: "SUGGESTION", title: "Bulk approve", idea: "Approve many orders at once" },
} as const;

const query = (filter: Record<string, string> = {}, search?: string): ListQuery => ({
  page: 0,
  size: 25,
  filter,
  ...(search ? { search } : {}),
});

describe("feedback form schema (B1)", () => {
  it.each(Object.entries(VALID))("accepts a complete %s report", (_category, feedback) => {
    expect(feedbackSubmitSchema.safeParse({ feedback, page, context: {} }).success).toBe(true);
  });

  it("names each missing required field for a bug", () => {
    const result = feedbackFormSchema.safeParse({ category: "BUG", title: "Broken" });
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((issue) => issue.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["steps", "expected", "actual", "severity"]));
  });

  it("asks for a title of at least 3 letters on every tab", () => {
    for (const feedback of Object.values(VALID)) {
      expect(feedbackFormSchema.safeParse({ ...feedback, title: "ab" }).success).toBe(false);
    }
  });

  it("caps the technical trail at 10 API calls", () => {
    const call = { method: "GET", url: "/orders", status: 500, durationMs: 12, at: "2026-10-24T10:00:00Z" };
    const context = { recentApi: Array.from({ length: 11 }, () => call) };
    expect(feedbackSubmitSchema.safeParse({ feedback: VALID.BUG, page, context }).success).toBe(false);
  });
});

describe("feedback service", () => {
  it("keeps only the chosen tab's answers, trimmed", () => {
    const form = feedbackFormSchema.parse({
      ...VALID.FINDABILITY,
      foundWhere: "   ",
      description: "extra",
    });
    expect(pickDetails(form)).toEqual({
      lookingFor: "Where to upload the POD",
      lookedWhere: "LR list",
      found: "NO",
    });
  });

  it("treats Fixed, Won't fix and Duplicate as resolved", () => {
    expect(["FIXED", "WONT_FIX", "DUPLICATE"].every((s) => isResolved(s as never))).toBe(true);
    expect(OPEN_STATUSES.some((s) => isResolved(s))).toBe(false);
    expect(statusChangeText("NEW", "FIXED")).toMatch(/^Status changed from .+ to .+\.$/);
  });

  it("filters the inbox by open status, type and FB number search", () => {
    expect(buildFeedbackWhere(query())).toEqual({});
    const where = buildFeedbackWhere(query({ status: "OPEN", category: "BUG", severity: "nope" }, "FB-0042"));
    const and = where.AND as Record<string, unknown>[];
    expect(and).toContainEqual({ status: { in: [...OPEN_STATUSES] } });
    expect(and).toContainEqual({ category: "BUG" });
    expect(and.some((clause) => "severity" in clause)).toBe(false);
    const search = and.find((clause) => "OR" in clause) as { OR: Record<string, unknown>[] };
    expect(search.OR).toContainEqual({ number: 42 });
  });

  it("includes the whole 'to' day in a date range", () => {
    const and = buildFeedbackWhere(query({ from: "2026-10-01", to: "2026-10-01" })).AND as {
      createdAt: { gte?: Date; lt?: Date };
    }[];
    const gte = and.find((clause) => clause.createdAt.gte)!.createdAt.gte!;
    const lt = and.find((clause) => clause.createdAt.lt)!.createdAt.lt!;
    expect(lt.getTime() - gte.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("allows 20 reports an hour per person", () => {
    const user = `rate-${Date.now()}`;
    const results = Array.from({ length: 21 }, () => takeSubmitSlot(user));
    expect(results.slice(0, 20).every(Boolean)).toBe(true);
    expect(results[20]).toBe(false);
    expect(takeSubmitSlot(`${user}-other`)).toBe(true);
  });
});

const row = (number: number, overrides: Partial<DocxRow> = {}): DocxRow => ({
  id: `fb-${number}`,
  number,
  category: "BUG",
  title: `Problem ${number}`,
  description: null,
  details: { steps: "Pressed save", expected: "Saved", actual: "Error" },
  severity: "MAJOR",
  status: "NEW",
  pagePath: page.path,
  pageTitle: page.title,
  moduleLabel: page.module,
  entityId: null,
  context: { userAgent: "Mozilla/5.0 Chrome/120.0", recentApi: [] },
  reporterName: "Asha Trainee",
  reporterRole: "Operations",
  reporterBranch: "Pune",
  assignee: null,
  devNotes: null,
  externalRef: null,
  reporterConfirmedAt: null,
  createdAt: new Date("2026-10-20T10:00:00Z"),
  comments: [],
  ...overrides,
});

describe("feedback exports (B5, B7)", () => {
  it("Excel has one row per item and the summary sheets", async () => {
    const rows = [row(1), row(2, { status: "FIXED", category: "UI", severity: null })];
    const wb = new ExcelJS.Workbook();
    const xlsx = await buildFeedbackXlsx(rows, { generatedAt: new Date() });
    await wb.xlsx.load(new Uint8Array(xlsx).buffer);
    expect(wb.worksheets.map((sheet) => sheet.name)).toEqual(["Feedback", "By page", "By status"]);
    expect(wb.getWorksheet("Feedback")!.actualRowCount).toBe(rows.length + 1);
    expect(String(wb.getWorksheet("Feedback")!.getRow(2).getCell(1).value)).toBe("FB-0001");
  });

  it("Word report is a valid .docx", async () => {
    const docx = await buildFeedbackDocx(
      [row(1, { comments: [{ authorName: "Dev", side: "TEAM", body: "Fixed", createdAt: new Date() }] })],
      new Map(),
      { generatedAt: new Date(), filters: "All feedback", skippedImages: 0 },
    );
    expect(docx.subarray(0, 2).toString()).toBe("PK");
    expect(docx.length).toBeGreaterThan(1000);
  });
});
