import { z } from "zod";

/**
 * In-app feedback — testing phase only (Jira label `remove-before-prod`).
 *
 * The form schema is a flat discriminated union on `category`, so each tab's
 * fields sit at the top level of the react-hook-form state and the shared
 * field components can show their errors. The server packs the
 * category-specific fields into `Feedback.details` (JSON).
 */

/* ------------------------------------------------------------------ */
/* Enums + labels                                                      */
/* ------------------------------------------------------------------ */

export const FEEDBACK_CATEGORIES = [
  "BUG",
  "FLOW",
  "UI",
  "FINDABILITY",
  "SUGGESTION",
] as const;
export const feedbackCategorySchema = z.enum(FEEDBACK_CATEGORIES);

export const FEEDBACK_STATUSES = [
  "NEW",
  "TRIAGED",
  "IN_PROGRESS",
  "FIXED",
  "WONT_FIX",
  "DUPLICATE",
] as const;
export const feedbackStatusSchema = z.enum(FEEDBACK_STATUSES);

export const FEEDBACK_SEVERITIES = ["BLOCKER", "MAJOR", "MINOR"] as const;
export const feedbackSeveritySchema = z.enum(FEEDBACK_SEVERITIES);

export const FEEDBACK_FREQUENCIES = ["ALWAYS", "SOMETIMES", "ONCE"] as const;
export const FEEDBACK_IMPACTS = [
  "BLOCKS_WORK",
  "EXTRA_WORK",
  "WRONG_DATA",
  "WRONG_AMOUNT",
] as const;
export const FEEDBACK_UI_PROBLEMS = [
  "HARD_TO_READ",
  "TOO_MANY_CLICKS",
  "CONFUSING_NAME",
  "MESSY_LAYOUT",
  "MISSING_FIELD",
  "OTHER",
] as const;
export const FEEDBACK_FOUND = ["YES", "NO"] as const;

type Labels<T extends readonly string[]> = Record<T[number], string>;

export const FEEDBACK_CATEGORY_LABELS: Labels<typeof FEEDBACK_CATEGORIES> = {
  BUG: "Bug",
  FLOW: "Wrong flow",
  UI: "UI change",
  FINDABILITY: "Hard to find",
  SUGGESTION: "Suggestion",
};

export const FEEDBACK_STATUS_LABELS: Labels<typeof FEEDBACK_STATUSES> = {
  NEW: "New",
  TRIAGED: "Reviewed",
  IN_PROGRESS: "In progress",
  FIXED: "Fixed",
  WONT_FIX: "Won't fix",
  DUPLICATE: "Duplicate",
};

export const FEEDBACK_SEVERITY_LABELS: Labels<typeof FEEDBACK_SEVERITIES> = {
  BLOCKER: "Blocker",
  MAJOR: "Major",
  MINOR: "Minor",
};

export const FEEDBACK_FREQUENCY_LABELS: Labels<typeof FEEDBACK_FREQUENCIES> = {
  ALWAYS: "Every time",
  SOMETIMES: "Sometimes",
  ONCE: "Only once",
};

export const FEEDBACK_IMPACT_LABELS: Labels<typeof FEEDBACK_IMPACTS> = {
  BLOCKS_WORK: "It stops my work",
  EXTRA_WORK: "It adds extra work",
  WRONG_DATA: "It saves wrong data",
  WRONG_AMOUNT: "It gives a wrong amount",
};

export const FEEDBACK_UI_PROBLEM_LABELS: Labels<typeof FEEDBACK_UI_PROBLEMS> = {
  HARD_TO_READ: "Hard to read",
  TOO_MANY_CLICKS: "Too many clicks",
  CONFUSING_NAME: "Confusing name or label",
  MESSY_LAYOUT: "Messy layout",
  MISSING_FIELD: "A field is missing",
  OTHER: "Something else",
};

export const FEEDBACK_FOUND_LABELS: Labels<typeof FEEDBACK_FOUND> = {
  YES: "Yes",
  NO: "No",
};

/* ------------------------------------------------------------------ */
/* Submit form (one schema per tab)                                    */
/* ------------------------------------------------------------------ */

const requiredText = (message: string, max = 2000) =>
  z
    .string({ required_error: message })
    .trim()
    .min(1, message)
    .max(max, `Please keep this under ${max} characters`);

const optionalText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max, `Please keep this under ${max} characters`)
    .optional();

const requiredChoice = <T extends readonly [string, ...string[]]>(
  values: T,
  message: string,
) => z.enum(values, { errorMap: () => ({ message }) });

const optionalChoice = <T extends readonly [string, ...string[]]>(values: T) =>
  z.union([z.enum(values), z.literal("")]).optional();

const commonFields = {
  title: z
    .string({ required_error: "Please write a short title" })
    .trim()
    .min(3, "Please write a short title (at least 3 letters)")
    .max(120, "Please keep the title under 120 characters"),
  description: optionalText(2000),
};

export const bugFeedbackSchema = z.object({
  category: z.literal("BUG"),
  ...commonFields,
  steps: requiredText("Tell us what you were doing"),
  expected: requiredText("Tell us what you expected to happen"),
  actual: requiredText("Tell us what happened instead"),
  severity: requiredChoice(
    FEEDBACK_SEVERITIES,
    "Choose how much this affects your work",
  ),
  frequency: optionalChoice(FEEDBACK_FREQUENCIES),
});

export const flowFeedbackSchema = z.object({
  category: z.literal("FLOW"),
  ...commonFields,
  step: requiredText("Tell us which step or action is wrong", 300),
  currentBehaviour: requiredText("Tell us what the system does now"),
  correctProcess: requiredText("Tell us how this is actually done at SK"),
  responsibleRole: optionalText(120),
  impact: optionalChoice(FEEDBACK_IMPACTS),
});

export const uiFeedbackSchema = z.object({
  category: z.literal("UI"),
  ...commonFields,
  element: requiredText("Tell us which part of the screen", 300),
  problem: requiredChoice(FEEDBACK_UI_PROBLEMS, "Choose what the problem is"),
  suggestion: requiredText("Tell us what would make it better"),
});

export const findabilityFeedbackSchema = z.object({
  category: z.literal("FINDABILITY"),
  ...commonFields,
  lookingFor: requiredText("Tell us what you were trying to find", 500),
  lookedWhere: requiredText("Tell us where you looked", 500),
  found: requiredChoice(FEEDBACK_FOUND, "Choose Yes or No"),
  foundWhere: optionalText(500),
});

export const suggestionFeedbackSchema = z.object({
  category: z.literal("SUGGESTION"),
  ...commonFields,
  idea: requiredText("Tell us your idea"),
  benefit: optionalText(2000),
});

export const feedbackFormSchema = z.discriminatedUnion("category", [
  bugFeedbackSchema,
  flowFeedbackSchema,
  uiFeedbackSchema,
  findabilityFeedbackSchema,
  suggestionFeedbackSchema,
]);

/**
 * Category-specific fields, in display order. Drives the admin detail view,
 * the Excel columns and the "Copy as Jira" text — so a label lives in one place.
 */
type DetailField = {
  key: string;
  label: string;
  choices?: Record<string, string>;
};

export const FEEDBACK_DETAIL_FIELDS = {
  BUG: [
    { key: "steps", label: "What they were doing" },
    { key: "expected", label: "What they expected" },
    { key: "actual", label: "What happened instead" },
    {
      key: "frequency",
      label: "How often it happens",
      choices: FEEDBACK_FREQUENCY_LABELS,
    },
  ],
  FLOW: [
    { key: "step", label: "Step or action" },
    { key: "currentBehaviour", label: "What the system does now" },
    { key: "correctProcess", label: "How SK actually does it" },
    { key: "responsibleRole", label: "Who should do this step" },
    { key: "impact", label: "Effect on work", choices: FEEDBACK_IMPACT_LABELS },
  ],
  UI: [
    { key: "element", label: "Part of the screen" },
    { key: "problem", label: "Problem", choices: FEEDBACK_UI_PROBLEM_LABELS },
    { key: "suggestion", label: "Suggested change" },
  ],
  FINDABILITY: [
    { key: "lookingFor", label: "Trying to find" },
    { key: "lookedWhere", label: "Where they looked" },
    { key: "found", label: "Found it?", choices: FEEDBACK_FOUND_LABELS },
    { key: "foundWhere", label: "Where it was" },
  ],
  SUGGESTION: [
    { key: "idea", label: "Idea" },
    { key: "benefit", label: "How it helps" },
  ],
} as const satisfies Record<
  (typeof FEEDBACK_CATEGORIES)[number],
  readonly DetailField[]
>;

/* ------------------------------------------------------------------ */
/* Page + technical context (captured automatically by the web app)    */
/* ------------------------------------------------------------------ */

export const feedbackPageSchema = z.object({
  path: z.string().trim().min(1).max(300),
  title: z.string().trim().min(1).max(160),
  module: z.string().trim().min(1).max(160),
  entityId: z.string().trim().max(80).optional(),
});

const feedbackApiEntrySchema = z.object({
  method: z.string().max(10),
  url: z.string().max(300),
  status: z.number().int().nullable(),
  durationMs: z.number().nonnegative().max(600_000).nullable(),
  message: z.string().max(300).optional(),
  at: z.string().max(40),
});

const feedbackClientErrorSchema = z.object({
  message: z.string().max(500),
  at: z.string().max(40),
});

export const feedbackContextSchema = z.object({
  appVersion: z.string().max(64).optional(),
  userAgent: z.string().max(400).optional(),
  viewport: z.string().max(32).optional(),
  screen: z.string().max(32).optional(),
  timezone: z.string().max(64).optional(),
  language: z.string().max(32).optional(),
  online: z.boolean().optional(),
  breadcrumb: z.array(z.string().max(160)).max(12).optional(),
  recentApi: z.array(feedbackApiEntrySchema).max(10).optional(),
  recentErrors: z.array(feedbackClientErrorSchema).max(5).optional(),
});

export const feedbackSubmitSchema = z.object({
  feedback: feedbackFormSchema,
  page: feedbackPageSchema,
  context: feedbackContextSchema,
});

/* ------------------------------------------------------------------ */
/* Triage (admin)                                                      */
/* ------------------------------------------------------------------ */

const emptyToNull = (value: string): string | null =>
  value === "" ? null : value;

/** Web submits the raw form (`raw: true` resolver); the server parse turns "" into null. */
export const feedbackTriageSchema = z.object({
  status: feedbackStatusSchema,
  severity: z
    .union([feedbackSeveritySchema, z.literal("")])
    .transform((value) => (value === "" ? null : value)),
  assignee: z
    .string()
    .trim()
    .max(120, "Please keep this under 120 characters")
    .transform(emptyToNull),
  externalRef: z
    .string()
    .trim()
    .max(40, "Please keep this under 40 characters")
    .transform(emptyToNull),
  devNotes: z
    .string()
    .trim()
    .max(4000, "Please keep notes under 4000 characters")
    .transform(emptyToNull),
});

export const feedbackBulkStatusSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  status: feedbackStatusSchema,
});
