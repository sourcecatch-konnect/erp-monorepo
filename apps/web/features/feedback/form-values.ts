import type {
  FeedbackCategory,
  FeedbackSeverity,
} from "@skerp/types";

/**
 * Flat react-hook-form state holding every tab's fields at once, so switching
 * tabs keeps what was typed. The shared `feedbackFormSchema` (a discriminated
 * union on `category`) validates only the active tab and strips the rest.
 */
export type FeedbackFormValues = {
  category: FeedbackCategory | "";
  title: string;
  description: string;
  // Bug
  steps: string;
  expected: string;
  actual: string;
  severity: FeedbackSeverity | "";
  frequency: string;
  // Wrong flow
  step: string;
  currentBehaviour: string;
  correctProcess: string;
  responsibleRole: string;
  impact: string;
  // UI change
  element: string;
  problem: string;
  suggestion: string;
  // Hard to find
  lookingFor: string;
  lookedWhere: string;
  found: string;
  foundWhere: string;
  // Suggestion
  idea: string;
  benefit: string;
};

export const EMPTY_FEEDBACK_VALUES: FeedbackFormValues = {
  category: "",
  title: "",
  description: "",
  steps: "",
  expected: "",
  actual: "",
  severity: "",
  frequency: "",
  step: "",
  currentBehaviour: "",
  correctProcess: "",
  responsibleRole: "",
  impact: "",
  element: "",
  problem: "",
  suggestion: "",
  lookingFor: "",
  lookedWhere: "",
  found: "",
  foundWhere: "",
  idea: "",
  benefit: "",
};
