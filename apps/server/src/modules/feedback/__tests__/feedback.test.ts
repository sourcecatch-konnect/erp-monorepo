import { describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_NOTHING_TO_SEND,
  FEEDBACK_QUESTIONS,
  LEGACY_FEEDBACK_DETAIL_FIELDS,
  feedbackFileRequestSchema,
  feedbackFormSchema,
  feedbackSubmitSchema,
} from "@skerp/validators";
import { feedbackFileKind, legacyDetailRows } from "@skerp/types";

vi.mock("../../../../prisma/prisma.js", () => ({ db: {} }));

import { buildFeedbackDocx, type DocxRow } from "../feedback.docx.js";
import { buildFeedbackXlsx } from "../feedback.export.js";
import {
  OPEN_STATUSES,
  buildFeedbackWhere,
  deriveTitle,
  isResolved,
  statusChangeText,
} from "../feedback.service.js";
import type { ListQuery } from "../../_shared/list.query.js";
import { rateLimit } from "../../../middlewares/rate-limit.middleware.js";

const page = { path: "/vp-management/vp-loading", title: "VP Loading", module: "Operations › VP Management" };

const FORM = {
  category: "BUG",
  impact: "HIGH",
  section: "",
  description: "Save does nothing",
  points: [],
  hasVoiceNote: false,
} as const;

const query = (filter: Record<string, string> = {}, search?: string): ListQuery => ({
  page: 0,
  size: 25,
  filter,
  ...(search ? { search } : {}),
});

describe("feedback form schema (v2)", () => {
  it("accepts text, a point or a voice note on its own", () => {
    const withText = feedbackFormSchema.safeParse(FORM);
    const withPoint = feedbackFormSchema.safeParse({ ...FORM, description: "", points: ["Wrong total"] });
    const withVoice = feedbackFormSchema.safeParse({ ...FORM, description: "", hasVoiceNote: true });
    expect([withText, withPoint, withVoice].every((result) => result.success)).toBe(true);
  });

  it("asks for something to send when there is no text, point or voice note", () => {
    const result = feedbackFormSchema.safeParse({ ...FORM, description: "  ", points: ["", " "] });
    expect(result.success).toBe(false);
    expect(result.error!.issues).toContainEqual(
      expect.objectContaining({ path: ["description"], message: FEEDBACK_NOTHING_TO_SEND }),
    );
  });

  it("requires a type", () => {
    const result = feedbackFormSchema.safeParse({ ...FORM, category: "" });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0]!.path).toEqual(["category"]);
  });

  it("drops empty points and caps them at 10 × 300 characters", () => {
    expect(feedbackFormSchema.parse({ ...FORM, points: [" One ", "", "Two"] }).points).toEqual(["One", "Two"]);
    expect(feedbackFormSchema.safeParse({ ...FORM, points: Array(11).fill("x") }).success).toBe(false);
    expect(feedbackFormSchema.safeParse({ ...FORM, points: ["x".repeat(301)] }).success).toBe(false);
  });

  it("caps the technical trail at 10 API calls", () => {
    const call = { method: "GET", url: "/orders", status: 500, durationMs: 12, at: "2026-10-24T10:00:00Z" };
    const context = { recentApi: Array.from({ length: 11 }, () => call) };
    expect(feedbackSubmitSchema.safeParse({ feedback: FORM, page, context }).success).toBe(false);
    expect(feedbackSubmitSchema.safeParse({ feedback: FORM, page, context: {} }).success).toBe(true);
  });
});

describe("feedback file requests", () => {
  const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  it("accepts each kind within its limits", () => {
    expect(
      feedbackFileRequestSchema.safeParse({ kind: "image", mime: "image/jpeg", sizeBytes: 200_000, width: 1600, height: 900 })
        .success,
    ).toBe(true);
    expect(
      feedbackFileRequestSchema.safeParse({ kind: "document", mime: DOCX, sizeBytes: 12 * 1024 * 1024, name: "Rates.docx" })
        .success,
    ).toBe(true);
    expect(
      feedbackFileRequestSchema.safeParse({ kind: "voice", mime: "audio/webm", sizeBytes: 900_000, durationSec: 180 }).success,
    ).toBe(true);
  });

  it("refuses old and macro-enabled Office files, CSV, big files and long voice notes", () => {
    for (const mime of ["application/vnd.ms-excel", "application/vnd.ms-word.document.macroEnabled.12", "text/csv"]) {
      expect(feedbackFileRequestSchema.safeParse({ kind: "document", mime, sizeBytes: 1000, name: "x" }).success).toBe(false);
    }
    expect(
      feedbackFileRequestSchema.safeParse({ kind: "document", mime: DOCX, sizeBytes: 12 * 1024 * 1024 + 1, name: "x" })
        .success,
    ).toBe(false);
    expect(
      feedbackFileRequestSchema.safeParse({ kind: "voice", mime: "audio/webm", sizeBytes: 1000, durationSec: 181 }).success,
    ).toBe(false);
    expect(
      feedbackFileRequestSchema.safeParse({ kind: "voice", mime: "audio/webm;codecs=opus", sizeBytes: 1000, durationSec: 5 })
        .success,
    ).toBe(false);
  });

  it("tells pictures, documents and voice notes apart by type", () => {
    expect(feedbackFileKind("image/jpeg")).toBe("image");
    expect(feedbackFileKind("audio/mp4")).toBe("voice");
    expect(feedbackFileKind("application/pdf")).toBe("document");
  });
});

describe("feedback service", () => {
  it("makes the title from the text, then the first point, then type and page", () => {
    expect(deriveTitle({ category: "BUG", description: "\n  Save does nothing  \nmore", points: ["x"] }, "VP Loading")).toBe(
      "Save does nothing",
    );
    expect(deriveTitle({ category: "BUG", points: ["Total is wrong"] }, "VP Loading")).toBe("Total is wrong");
    expect(deriveTitle({ category: "IMPROVEMENT", points: [] }, "Order Board")).toBe("Improvement on Order Board");
  });

  it("cuts long titles at a word boundary", () => {
    const title = deriveTitle({ category: "BUG", description: "word ".repeat(40), points: [] }, "VP Loading");
    expect(title.length).toBeLessThanOrEqual(120);
    expect(title.endsWith("word…")).toBe(true);
  });

  it("treats Fixed, Won't fix and Duplicate as resolved", () => {
    expect(["FIXED", "WONT_FIX", "DUPLICATE"].every((s) => isResolved(s as never))).toBe(true);
    expect(OPEN_STATUSES.some((s) => isResolved(s))).toBe(false);
    expect(statusChangeText("NEW", "FIXED")).toMatch(/^Status changed from .+ to .+\.$/);
  });

  it("filters the inbox by open status, type, impact and FB number search", () => {
    expect(buildFeedbackWhere(query())).toEqual({});
    const where = buildFeedbackWhere(
      query({ status: "OPEN", category: "BUG", impact: "CRITICAL", severity: "MAJOR" }, "FB-0042"),
    );
    const and = where.AND as Record<string, unknown>[];
    expect(and).toContainEqual({ status: { in: [...OPEN_STATUSES] } });
    expect(and).toContainEqual({ category: "BUG" });
    expect(and).toContainEqual({ impact: "CRITICAL" });
    expect(and.some((clause) => "severity" in clause)).toBe(false);
    const search = and.find((clause) => "OR" in clause) as { OR: Record<string, unknown>[] };
    expect(search.OR).toContainEqual({ number: 42 });
    expect(search.OR).toContainEqual({ description: { contains: "FB-0042", mode: "insensitive" } });
  });

  it("ignores an impact that isn't one of the four", () => {
    const and = (buildFeedbackWhere(query({ impact: "BLOCKER" })).AND ?? []) as Record<string, unknown>[];
    expect(and.some((clause) => "impact" in clause)).toBe(false);
  });

  it("includes the whole 'to' day in a date range", () => {
    const and = buildFeedbackWhere(query({ from: "2026-10-01", to: "2026-10-01" })).AND as {
      createdAt: { gte?: Date; lt?: Date };
    }[];
    const gte = and.find((clause) => clause.createdAt.gte)!.createdAt.gte!;
    const lt = and.find((clause) => clause.createdAt.lt)!.createdAt.lt!;
    expect(lt.getTime() - gte.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("allows 20 reports an hour per person, then answers 429 with Retry-After", () => {
    // The same limiter the route mounts on POST /feedback.
    const limiter = rateLimit({
      name: "feedback-submit",
      windowMs: 60 * 60 * 1000,
      max: 20,
      key: (req) => req.ctx!.userId,
    });
    const call = (userId: string) => {
      const headers: Record<string, string> = {};
      let status = 0;
      let passed = false;
      const res = {
        setHeader: (k: string, v: string) => { headers[k] = v; },
        status: (s: number) => { status = s; return res; },
        json: () => res,
      };
      limiter({ ctx: { userId } } as never, res as never, () => { passed = true; });
      return { passed, status, headers };
    };

    const user = `rate-${Date.now()}`;
    const results = Array.from({ length: 21 }, () => call(user));
    expect(results.slice(0, 20).every((r) => r.passed)).toBe(true);

    const blocked = results[20]!;
    expect(blocked.passed).toBe(false);
    expect(blocked.status).toBe(429);
    // The reporter is told when to come back, not just "later".
    expect(Number(blocked.headers["Retry-After"])).toBeGreaterThan(0);
    expect(blocked.headers["X-RateLimit-Limit"]).toBe("20");
    expect(blocked.headers["X-RateLimit-Remaining"]).toBe("0");

    // Counted per person: one noisy reporter never blocks anyone else.
    expect(call(`${user}-other`).passed).toBe(true);
  });

  it("labels v1 answers for migrated items", () => {
    expect(legacyDetailRows({ steps: "Pressed save", frequency: "ALWAYS", unknown: "x", found: "" })).toEqual([
      ["What they were doing", "Pressed save"],
      ["How often it happens", "Every time"],
    ]);
    expect(legacyDetailRows({})).toEqual([]);
  });
});

const row = (number: number, overrides: Partial<DocxRow> = {}): DocxRow => ({
  id: `fb-${number}`,
  number,
  category: "BUG",
  impact: "HIGH",
  title: `Problem ${number}`,
  description: "Save does nothing",
  points: ["Open an LR", "Press Save"],
  section: "Freight",
  details: {},
  voiceSeconds: 102,
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

const cellByHeader = (sheet: ExcelJS.Worksheet, rowNumber: number, header: string) => {
  const headers = sheet.getRow(1).values as unknown[];
  return sheet.getRow(rowNumber).getCell(headers.indexOf(header)).value;
};

describe("feedback exports (B5, B7)", () => {
  it("Excel has one row per item, the v2 columns and the summary sheets", async () => {
    const rows = [
      row(1),
      row(2, {
        status: "FIXED",
        category: "IMPROVEMENT",
        description: null,
        points: [],
        voiceSeconds: null,
        details: { idea: "Approve many orders at once" },
      }),
    ];
    const files = new Map([
      [
        "fb-1",
        [
          { kind: "image" as const, name: "picture-1600x900.jpg" },
          { kind: "document" as const, name: "Rates.xlsx" },
        ],
      ],
    ]);
    const wb = new ExcelJS.Workbook();
    const xlsx = await buildFeedbackXlsx(rows, { generatedAt: new Date(), files });
    await wb.xlsx.load(new Uint8Array(xlsx).buffer);
    expect(wb.worksheets.map((sheet) => sheet.name)).toEqual(["Feedback", "By page", "By status"]);
    const sheet = wb.getWorksheet("Feedback")!;
    expect(sheet.actualRowCount).toBe(rows.length + 1);
    expect(String(sheet.getRow(2).getCell(1).value)).toBe("FB-0001");
    expect(cellByHeader(sheet, 2, "Impact")).toBe("High");
    expect(cellByHeader(sheet, 2, "Points")).toBe("1. Open an LR\n2. Press Save");
    expect(cellByHeader(sheet, 2, "Voice note")).toBe("1:42");
    expect(cellByHeader(sheet, 2, "Pictures")).toBe(1);
    expect(cellByHeader(sheet, 2, "Documents")).toBe("Rates.xlsx");
    expect(cellByHeader(sheet, 3, "Old form answers")).toBe("Idea: Approve many orders at once");
  });

  it("Word report is a valid .docx", async () => {
    const docx = await buildFeedbackDocx(
      [row(1, { comments: [{ authorName: "Dev", side: "TEAM", body: "Fixed", createdAt: new Date() }] })],
      new Map(),
      {
        generatedAt: new Date(),
        filters: "All feedback",
        skippedImages: 0,
        files: new Map([["fb-1", [{ kind: "document", name: "Rates.xlsx" }]]]),
      },
    );
    expect(docx.subarray(0, 2).toString()).toBe("PK");
    expect(docx.length).toBeGreaterThan(1000);
  });
});

describe("guided questions", () => {
  const base = { category: "BUG", impact: "HIGH", section: "", points: [], hasVoiceNote: false };

  it("asks questions for every type, and none for Other", () => {
    for (const category of FEEDBACK_CATEGORIES) {
      const questions = FEEDBACK_QUESTIONS[category] ?? [];
      if (category === "OTHER") expect(questions).toHaveLength(0);
      else expect(questions.length).toBeGreaterThan(0);
    }
  });

  it("labels every question key, so answers show in the admin view and the exports", () => {
    const labelled = new Set(LEGACY_FEEDBACK_DETAIL_FIELDS.map((field) => field.key));
    for (const questions of Object.values(FEEDBACK_QUESTIONS)) {
      for (const question of questions) expect(labelled).toContain(question.key);
    }
  });

  it("keeps question keys unique within a type", () => {
    for (const questions of Object.values(FEEDBACK_QUESTIONS)) {
      const keys = questions.map((question) => question.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("accepts answers on their own — the questions can carry the whole report", () => {
    const parsed = feedbackFormSchema.safeParse({ ...base, answers: { steps: "I pressed Save" } });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.answers).toEqual({ steps: "I pressed Save" });
  });

  it("drops blank and whitespace-only answers", () => {
    const parsed = feedbackFormSchema.safeParse({
      ...base,
      description: "something",
      answers: { steps: "I pressed Save", expected: "", actual: "   " },
    });
    expect(parsed.success && parsed.data.answers).toEqual({ steps: "I pressed Save" });
  });

  it("still refuses a report with nothing in it at all", () => {
    const parsed = feedbackFormSchema.safeParse({ ...base, answers: { steps: "  " } });
    expect(parsed.success).toBe(false);
    expect(parsed.success === false && parsed.error.issues[0]?.message).toBe(FEEDBACK_NOTHING_TO_SEND);
  });

  it("titles an answers-only report from the first answer, not the page name", () => {
    expect(
      deriveTitle({ category: "BUG", points: [], answers: { steps: "Save does nothing" } }, "VP Loading"),
    ).toBe("Save does nothing");
  });

  it("renders answers with their labels", () => {
    expect(legacyDetailRows({ steps: "I pressed Save", wrongValue: "0" })).toEqual([
      ["What they were doing", "I pressed Save"],
      ["What it shows", "0"],
    ]);
  });
});
