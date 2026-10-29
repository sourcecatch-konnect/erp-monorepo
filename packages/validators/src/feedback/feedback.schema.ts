import { z } from "zod";

/**
 * In-app feedback — testing phase only (Jira label `remove-before-prod`).
 *
 * v2 (docs/FEEDBACK_V2_PLAN.md): one short form on every page — type, impact,
 * optional page section, free text, points, a voice note and files. The server
 * makes the title. Items sent with the v1 five-tab form keep their answers in
 * `Feedback.details`, labelled by LEGACY_FEEDBACK_DETAIL_FIELDS.
 */

/* ------------------------------------------------------------------ */
/* Enums + labels                                                      */
/* ------------------------------------------------------------------ */

export const FEEDBACK_CATEGORIES = [
  "BUG",
  "IMPROVEMENT",
  "MISSING_FEATURE",
  "CONFUSING",
  "DATA_ISSUE",
  "TRAINING_HELP",
  "OTHER",
] as const;
export const feedbackCategorySchema = z.enum(FEEDBACK_CATEGORIES);

export const FEEDBACK_IMPACTS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const feedbackImpactSchema = z.enum(FEEDBACK_IMPACTS);

export const FEEDBACK_STATUSES = [
  "NEW",
  "TRIAGED",
  "IN_PROGRESS",
  "FIXED",
  "WONT_FIX",
  "DUPLICATE",
] as const;
export const feedbackStatusSchema = z.enum(FEEDBACK_STATUSES);

type Labels<T extends readonly string[]> = Record<T[number], string>;

export const FEEDBACK_CATEGORY_LABELS: Labels<typeof FEEDBACK_CATEGORIES> = {
  BUG: "Bug",
  IMPROVEMENT: "Improvement",
  MISSING_FEATURE: "Missing feature",
  CONFUSING: "Confusing",
  DATA_ISSUE: "Data issue",
  TRAINING_HELP: "Training / help issue",
  OTHER: "Other",
};

export const FEEDBACK_IMPACT_LABELS: Labels<typeof FEEDBACK_IMPACTS> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export const FEEDBACK_STATUS_LABELS: Labels<typeof FEEDBACK_STATUSES> = {
  NEW: "New",
  TRIAGED: "Reviewed",
  IN_PROGRESS: "In progress",
  FIXED: "Fixed",
  WONT_FIX: "Won't fix",
  DUPLICATE: "Duplicate",
};

/* ------------------------------------------------------------------ */
/* Limits                                                              */
/* ------------------------------------------------------------------ */

export const FEEDBACK_MAX_POINTS = 10;
export const FEEDBACK_MAX_POINT_CHARS = 300;
export const FEEDBACK_MAX_DESCRIPTION_CHARS = 4000;
export const FEEDBACK_MAX_SECTION_CHARS = 120;
/** One answer to a guided question (see FEEDBACK_QUESTIONS). */
export const FEEDBACK_MAX_ANSWER_CHARS = 1000;

/** Images + documents together. The voice note is counted separately. */
export const FEEDBACK_MAX_FILES = 6;
export const FEEDBACK_MAX_FILE_BYTES = 12 * 1024 * 1024;
export const FEEDBACK_MAX_VOICE_SECONDS = 180;
export const FEEDBACK_MAX_VOICE_BYTES = 10 * 1024 * 1024;

/** Pictures are re-encoded to JPEG in the browser before upload. */
export const FEEDBACK_IMAGE_MIMES = ["image/jpeg", "image/png"] as const;

/**
 * No .doc/.xls (old binary formats), no .docm/.xlsm (macros), no CSV
 * (formula injection): antivirus scanning is not wired up yet.
 */
export const FEEDBACK_DOCUMENT_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

/** Base types only — the codec part (";codecs=opus") is dropped before upload. */
export const FEEDBACK_VOICE_MIMES = ["audio/webm", "audio/mp4", "audio/ogg"] as const;

export type FeedbackDocumentMime = (typeof FEEDBACK_DOCUMENT_MIMES)[number];
export type FeedbackVoiceMime = (typeof FEEDBACK_VOICE_MIMES)[number];

/** File extension for each accepted document type (also the browser's fallback when `file.type` is empty). */
export const FEEDBACK_DOCUMENT_EXTENSIONS: Record<FeedbackDocumentMime, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

export const FEEDBACK_VOICE_EXTENSIONS: Record<FeedbackVoiceMime, string> = {
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
};

/* ------------------------------------------------------------------ */
/* Submit form                                                         */
/* ------------------------------------------------------------------ */

export const FEEDBACK_NOTHING_TO_SEND =
  "Tell us what happened: type it, add a point, or record your voice.";

/**
 * Required: a type, plus at least one of the text, a point or a voice note.
 * `hasVoiceNote` is set by the browser when a recording is waiting to be
 * uploaded — the upload itself happens after the item is created.
 */
export const feedbackFormSchema = z
  .object({
    category: z.enum(FEEDBACK_CATEGORIES, {
      errorMap: () => ({ message: "Choose a type" }),
    }),
    impact: feedbackImpactSchema,
    section: z.string().trim().max(FEEDBACK_MAX_SECTION_CHARS).optional(),
    description: z
      .string()
      .trim()
      .max(
        FEEDBACK_MAX_DESCRIPTION_CHARS,
        `Please keep this under ${FEEDBACK_MAX_DESCRIPTION_CHARS} characters`,
      )
      .optional(),
    points: z
      .array(
        z
          .string()
          .trim()
          .max(
            FEEDBACK_MAX_POINT_CHARS,
            `Please keep each point under ${FEEDBACK_MAX_POINT_CHARS} characters`,
          ),
      )
      .max(FEEDBACK_MAX_POINTS, `You can add up to ${FEEDBACK_MAX_POINTS} points`)
      .transform((points) => points.filter((point) => point.length > 0)),
    /*
     * Answers to the guided questions for the chosen type, keyed by question.
     * Stored as-is in `Feedback.details`; empty answers are dropped so an
     * untouched question leaves no trace.
     */
    answers: z
      .record(
        z
          .string()
          .trim()
          .max(
            FEEDBACK_MAX_ANSWER_CHARS,
            `Please keep each answer under ${FEEDBACK_MAX_ANSWER_CHARS} characters`,
          ),
      )
      .optional()
      .transform((answers) =>
        Object.fromEntries(
          Object.entries(answers ?? {}).filter(([, value]) => value !== ""),
        ),
      ),
    hasVoiceNote: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (
      !value.description &&
      value.points.length === 0 &&
      Object.keys(value.answers).length === 0 &&
      !value.hasVoiceNote
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["description"],
        message: FEEDBACK_NOTHING_TO_SEND,
      });
    }
  });

/* ------------------------------------------------------------------ */
/* Guided questions, per type                                          */
/* ------------------------------------------------------------------ */

export type FeedbackQuestion = {
  /** Stored under this key in `Feedback.details`. */
  key: string;
  label: string;
  placeholder: string;
  /** Long answers get a textarea; short ones a single line. */
  long?: boolean;
};


/**
 * What we ask once the reporter has chosen a type.
 *
 * A blank box asking people to "describe the issue" gets one-line reports
 * that nobody can act on. Three plain questions get a report the team can
 * reproduce. They are optional on purpose — the reporter must say something,
 * but no single question blocks a quick note, so "this is confusing" still
 * takes ten seconds.
 *
 * Keys are unique across every type, so one answer map covers the form and
 * `detailRows` can label them without knowing the type.
 */
export const FEEDBACK_QUESTIONS: Record<string, readonly FeedbackQuestion[]> = {
  BUG: [
    {
      key: "steps",
      label: "What were you doing?",
      placeholder: "I opened the LR form and pressed Save…",
      long: true,
    },
    {
      key: "expected",
      label: "What did you expect to happen?",
      placeholder: "The LR should be saved and get a number.",
    },
    {
      key: "actual",
      label: "What happened instead?",
      placeholder: "Nothing happened. The page stayed the same.",
    },
  ],
  IMPROVEMENT: [
    {
      key: "currentBehaviour",
      label: "What do you have to do now?",
      placeholder: "I open each order one by one to approve it.",
      long: true,
    },
    {
      key: "suggestion",
      label: "What would make it better?",
      placeholder: "Let me tick several orders and approve them together.",
      long: true,
    },
  ],
  MISSING_FEATURE: [
    {
      key: "lookingFor",
      label: "What do you need to do?",
      placeholder: "Print a delivery challan for a part load.",
      long: true,
    },
    {
      key: "workaround",
      label: "How are you managing without it?",
      placeholder: "We write it by hand and keep it in a register.",
      long: true,
    },
  ],
  CONFUSING: [
    {
      key: "element",
      label: "Which part of the screen?",
      placeholder: "The 'TBB' column on the LR list.",
    },
    {
      key: "lookedWhere",
      label: "What did you think it meant, or where did you look?",
      placeholder: "I looked under Trips first, then under Orders.",
      long: true,
    },
  ],
  DATA_ISSUE: [
    {
      key: "wrongValue",
      label: "What does it show?",
      placeholder: "Freight shows 0 for LR-1042.",
    },
    {
      key: "correctValue",
      label: "What should it show?",
      placeholder: "It should show 18,500 as per the rate for this route.",
    },
    {
      key: "howToCheck",
      label: "Where can the team check this?",
      placeholder: "Open LR-1042, or the rate matrix for Pune to Nagpur.",
      long: true,
    },
  ],
  TRAINING_HELP: [
    {
      key: "lessonRef",
      label: "Which lesson or help text?",
      placeholder: "The 'Book an order' lesson, step 3.",
    },
    {
      key: "correctProcess",
      label: "What does it say, and what is actually right?",
      placeholder: "It says the manager approves. At SK the branch head does.",
      long: true,
    },
  ],
  OTHER: [],
};

/* ------------------------------------------------------------------ */
/* v1 answers (shown for items sent before v2)                         */
/* ------------------------------------------------------------------ */

type LegacyDetailField = {
  key: string;
  label: string;
  choices?: Record<string, string>;
};

/** Every question the v1 five-tab form asked, in display order. */
export const LEGACY_FEEDBACK_DETAIL_FIELDS: readonly LegacyDetailField[] = [
  { key: "steps", label: "What they were doing" },
  { key: "expected", label: "What they expected" },
  { key: "actual", label: "What happened instead" },
  {
    key: "frequency",
    label: "How often it happens",
    choices: { ALWAYS: "Every time", SOMETIMES: "Sometimes", ONCE: "Only once" },
  },
  { key: "step", label: "Step or action" },
  { key: "currentBehaviour", label: "What the system does now" },
  { key: "correctProcess", label: "How SK actually does it" },
  { key: "responsibleRole", label: "Who should do this step" },
  {
    key: "impact",
    label: "Effect on work",
    choices: {
      BLOCKS_WORK: "It stops my work",
      EXTRA_WORK: "It adds extra work",
      WRONG_DATA: "It saves wrong data",
      WRONG_AMOUNT: "It gives a wrong amount",
    },
  },
  { key: "element", label: "Part of the screen" },
  {
    key: "problem",
    label: "Problem",
    choices: {
      HARD_TO_READ: "Hard to read",
      TOO_MANY_CLICKS: "Too many clicks",
      CONFUSING_NAME: "Confusing name or label",
      MESSY_LAYOUT: "Messy layout",
      MISSING_FIELD: "A field is missing",
      OTHER: "Something else",
    },
  },
  { key: "suggestion", label: "Suggested change" },
  { key: "lookingFor", label: "Trying to find" },
  { key: "lookedWhere", label: "Where they looked" },
  { key: "found", label: "Found it?", choices: { YES: "Yes", NO: "No" } },
  { key: "foundWhere", label: "Where it was" },
  { key: "idea", label: "Idea" },
  { key: "benefit", label: "How it helps" },
  /*
   * Keys the guided questions added in v2. The rest of FEEDBACK_QUESTIONS
   * deliberately reuses the keys above, so an answer to "What were you doing?"
   * lands in `steps` and reads the same in the admin view whether it was sent
   * by the old form or the new one.
   */
  { key: "workaround", label: "Managing without it by" },
  { key: "wrongValue", label: "What it shows" },
  { key: "correctValue", label: "What it should show" },
  { key: "howToCheck", label: "Where to check it" },
  { key: "lessonRef", label: "Lesson or help text" },
];

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

/** The part of the screen picked with "Point at it on screen" (B6). */
export const feedbackElementSchema = z.object({
  selector: z.string().max(500),
  tag: z.string().max(40),
  text: z.string().max(120).optional(),
  rect: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number().nonnegative(),
    height: z.number().nonnegative(),
  }),
});

export const feedbackContextSchema = z.object({
  element: feedbackElementSchema.optional(),
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
  /** What the reporter attached, so the team can see if an upload never arrived. */
  attachmentsPlanned: z
    .object({
      voice: z.boolean(),
      images: z.number().int().min(0).max(FEEDBACK_MAX_FILES),
      documents: z.number().int().min(0).max(FEEDBACK_MAX_FILES),
    })
    .optional(),
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
  impact: feedbackImpactSchema,
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

/* ------------------------------------------------------------------ */
/* Files + voice note (uploaded after the item is created)             */
/* ------------------------------------------------------------------ */

export const FEEDBACK_FILE_KINDS = ["image", "document", "voice"] as const;

/** POST /feedback/:id/files — one request per file, answered with a presigned PUT URL. */
export const feedbackFileRequestSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("image"),
    mime: z.enum(FEEDBACK_IMAGE_MIMES),
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(FEEDBACK_MAX_FILE_BYTES, "Files must be smaller than 12 MB"),
    width: z.number().int().positive().max(10_000),
    height: z.number().int().positive().max(20_000),
  }),
  z.object({
    kind: z.literal("document"),
    mime: z.enum(FEEDBACK_DOCUMENT_MIMES),
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(FEEDBACK_MAX_FILE_BYTES, "Files must be smaller than 12 MB"),
    name: z.string().trim().min(1).max(160),
  }),
  z.object({
    kind: z.literal("voice"),
    mime: z.enum(FEEDBACK_VOICE_MIMES),
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(FEEDBACK_MAX_VOICE_BYTES, "The voice note is too large"),
    durationSec: z.number().int().min(1).max(FEEDBACK_MAX_VOICE_SECONDS),
  }),
]);

/** POST /feedback/:id/files/:attachmentId/complete — a voice note sends its length. */
export const feedbackFileCompleteSchema = z.object({
  durationSec: z.number().int().min(1).max(FEEDBACK_MAX_VOICE_SECONDS).optional(),
});

/* ------------------------------------------------------------------ */
/* Conversation + fix confirmation (B8)                                */
/* ------------------------------------------------------------------ */

export const FEEDBACK_COMMENT_KINDS = [
  "COMMENT",
  "STATUS_CHANGE",
  "CONFIRMED_FIXED",
  "STILL_BROKEN",
] as const;
export const feedbackCommentKindSchema = z.enum(FEEDBACK_COMMENT_KINDS);

export const FEEDBACK_COMMENT_SIDES = ["REPORTER", "TEAM"] as const;
export const feedbackCommentSideSchema = z.enum(FEEDBACK_COMMENT_SIDES);

export const feedbackCommentSchema = z.object({
  body: z
    .string({ required_error: "Write a message first" })
    .trim()
    .min(1, "Write a message first")
    .max(2000, "Please keep your message under 2000 characters"),
});

export const FEEDBACK_CONFIRM_OUTCOMES = [
  "CONFIRMED_FIXED",
  "STILL_BROKEN",
] as const;

/** The reporter's answer when the team marks their item FIXED. */
export const feedbackConfirmSchema = z.object({
  outcome: z.enum(FEEDBACK_CONFIRM_OUTCOMES),
  comment: z
    .string()
    .trim()
    .max(2000, "Please keep your message under 2000 characters")
    .optional(),
});

/* ------------------------------------------------------------------ */
/* Voice notes (B9)                                                    */
/* ------------------------------------------------------------------ */

/**
 * A spoken report, recorded in the browser and attached like a screenshot.
 *
 * The point is reach, not convenience: a driver or branch clerk who cannot
 * write the problem in English can hold a button and say it in Hindi. The
 * text fields stay required, so a voice note adds detail rather than
 * replacing the title the team triages on.
 */
/** Length and size limits are shared with the unified file upload above. */
export const FEEDBACK_MAX_VOICE_NOTES = 2;
/** Presign request for one voice note, sent after the feedback is created. */
export const feedbackVoiceNoteRequestSchema = z.object({
  mime: z.enum(FEEDBACK_VOICE_MIMES),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(
      FEEDBACK_MAX_VOICE_BYTES,
      `Voice notes must be smaller than ${FEEDBACK_MAX_VOICE_BYTES / (1024 * 1024)} MB`,
    ),
  durationSeconds: z
    .number()
    .int()
    .positive()
    .max(
      FEEDBACK_MAX_VOICE_SECONDS,
      `Voice notes can be up to ${FEEDBACK_MAX_VOICE_SECONDS} seconds`,
    ),
});
