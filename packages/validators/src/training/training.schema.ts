import { z } from "zod";

export const TRAINING_STEP_STATUSES = ["DONE", "SKIPPED"] as const;
export const trainingStepStatusSchema = z.enum(TRAINING_STEP_STATUSES);

export const TRAINING_COMPLETED_BY = ["SELF", "SYSTEM"] as const;
export const trainingCompletedBySchema = z.enum(TRAINING_COMPLETED_BY);

/** e.g. "ops.book-order", "tour.lr-form", "welcome". */
export const trainingStepKeySchema = z
  .string()
  .regex(/^[a-z0-9_.-]{1,80}$/i, "Invalid step key");

export const trainingProgressSchema = z.object({
  stepKey: trainingStepKeySchema,
  status: trainingStepStatusSchema,
});

/* ------------------------------------------------------------------ */
/* Admin: role description + track assignment (A5)                     */
/* ------------------------------------------------------------------ */

export const trainingTrackKeySchema = z
  .string()
  .regex(/^[a-z0-9-]{1,40}$/, "Invalid training track");

const MAX_RESPONSIBILITIES = 12;
const MAX_RESPONSIBILITY_LENGTH = 200;

const roleSummarySchema = z
  .string()
  .trim()
  .max(600, "Please keep the description under 600 characters");

/**
 * PUT /training/admin/roles/:roleId. An empty `tracks` list means "use the
 * suggested training" (worked out from the role's permissions).
 */
export const trainingRoleUpdateSchema = z.object({
  summary: roleSummarySchema,
  responsibilities: z
    .array(z.string().trim().min(1).max(MAX_RESPONSIBILITY_LENGTH))
    .max(MAX_RESPONSIBILITIES),
  tracks: z
    .array(z.object({ trackKey: trainingTrackKeySchema, required: z.boolean() }))
    .max(20),
});

/** One responsibility per line, blank lines ignored. */
export const responsibilitiesFromText = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

/** The admin edit form; converted to trainingRoleUpdateSchema on submit. */
export const trainingRoleFormSchema = z.object({
  summary: roleSummarySchema,
  responsibilitiesText: z.string().refine(
    (text) => {
      const lines = responsibilitiesFromText(text);
      return (
        lines.length <= MAX_RESPONSIBILITIES &&
        lines.every((line) => line.length <= MAX_RESPONSIBILITY_LENGTH)
      );
    },
    {
      message: `Up to ${MAX_RESPONSIBILITIES} lines, each under ${MAX_RESPONSIBILITY_LENGTH} characters`,
    },
  ),
  useSuggested: z.boolean(),
  requiredTracks: z.array(trainingTrackKeySchema),
});

/* ------------------------------------------------------------------ */
/* Quizzes (A10)                                                       */
/* ------------------------------------------------------------------ */

/** POST /training/quiz/:trackKey — questionId → chosen option index. */
export const trainingQuizSubmitSchema = z.object({
  answers: z.record(
    z.string().regex(/^[a-z0-9.-]{1,40}$/, "Invalid question"),
    z.number().int().min(0).max(9),
  ),
});
