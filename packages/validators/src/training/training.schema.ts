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
