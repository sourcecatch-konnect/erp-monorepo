import { FEEDBACK_CATEGORIES, FEEDBACK_IMPACTS } from "@skerp/validators";
import type { FeedbackCategory, FeedbackImpact } from "@skerp/types";

const isOneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (values as readonly string[]).includes(value);

/**
 * react-hook-form state for the Give feedback form. Validated by the shared
 * `feedbackFormSchema`; "" means "not chosen" for the type and "whole screen"
 * for the section. `hasVoiceNote` mirrors the recording held by the sheet.
 */
export type FeedbackFormValues = {
  category: FeedbackCategory | "";
  impact: FeedbackImpact;
  section: string;
  description: string;
  points: string[];
  hasVoiceNote: boolean;
};

export const EMPTY_FEEDBACK_VALUES: FeedbackFormValues = {
  category: "",
  impact: "MEDIUM",
  section: "",
  description: "",
  points: [""],
  hasVoiceNote: false,
};

/** A stored draft may come from the v1 form or be partial — keep only what fits. */
export function restoreDraft(draft: Partial<FeedbackFormValues> | null): FeedbackFormValues {
  if (!draft) return EMPTY_FEEDBACK_VALUES;
  const points = Array.isArray(draft.points)
    ? draft.points.filter((point): point is string => typeof point === "string")
    : [];
  return {
    ...EMPTY_FEEDBACK_VALUES,
    category: isOneOf(FEEDBACK_CATEGORIES, draft.category) ? draft.category : "",
    impact: isOneOf(FEEDBACK_IMPACTS, draft.impact) ? draft.impact : "MEDIUM",
    section: typeof draft.section === "string" ? draft.section : "",
    description: typeof draft.description === "string" ? draft.description : "",
    points: points.length > 0 ? points : [""],
  };
}
