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
  /** Answers to the guided questions for the chosen type, keyed by question. */
  answers: Record<string, string>;
  hasVoiceNote: boolean;
};

export const EMPTY_FEEDBACK_VALUES: FeedbackFormValues = {
  category: "",
  impact: "MEDIUM",
  section: "",
  description: "",
  points: [""],
  answers: {},
  hasVoiceNote: false,
};

/**
 * A stored draft may come from an older form or be partial — keep only what fits.
 *
 * `points` and `answers` no longer have any UI: the form asks for one free-text
 * description instead. They stay on the type because the shared schema still
 * accepts them (and older items are still displayed with them), but a draft
 * written by the previous form must not resurface answers the reporter can no
 * longer see or edit. `section` is kept: it has no field either, but pointing
 * at the screen fills it in silently and it is worth carrying.
 */
export function restoreDraft(draft: Partial<FeedbackFormValues> | null): FeedbackFormValues {
  if (!draft) return EMPTY_FEEDBACK_VALUES;
  return {
    ...EMPTY_FEEDBACK_VALUES,
    category: isOneOf(FEEDBACK_CATEGORIES, draft.category) ? draft.category : "",
    impact: isOneOf(FEEDBACK_IMPACTS, draft.impact) ? draft.impact : "MEDIUM",
    section: typeof draft.section === "string" ? draft.section : "",
    description: typeof draft.description === "string" ? draft.description : "",
  };
}
