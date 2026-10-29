import {
  IconBug,
  IconBulb,
  IconDatabaseExclamation,
  IconDots,
  IconHelpCircle,
  IconPuzzle,
  IconSchool,
  type Icon,
} from "@tabler/icons-react";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_IMPACTS,
  FEEDBACK_IMPACT_LABELS,
} from "@skerp/validators";
import type { FeedbackCategory, FeedbackImpact } from "@skerp/types";

/** How each feedback type is introduced to the person reporting it. */
export type CategoryMeta = {
  value: FeedbackCategory;
  label: string;
  hint: string;
  icon: Icon;
};

const CATEGORY_DETAILS: Record<FeedbackCategory, { hint: string; icon: Icon }> = {
  BUG: { hint: "Something is broken or shows an error.", icon: IconBug },
  IMPROVEMENT: { hint: "It works, but could be better.", icon: IconBulb },
  MISSING_FEATURE: { hint: "Something we need isn't there.", icon: IconPuzzle },
  CONFUSING: { hint: "Hard to understand or to find.", icon: IconHelpCircle },
  DATA_ISSUE: { hint: "Wrong, missing or duplicate data.", icon: IconDatabaseExclamation },
  TRAINING_HELP: { hint: "Help text or training is wrong or missing.", icon: IconSchool },
  OTHER: { hint: "Anything else.", icon: IconDots },
};

export const CATEGORY_META: Record<FeedbackCategory, CategoryMeta> = Object.fromEntries(
  FEEDBACK_CATEGORIES.map((value) => [
    value,
    { value, label: FEEDBACK_CATEGORY_LABELS[value], ...CATEGORY_DETAILS[value] },
  ]),
) as Record<FeedbackCategory, CategoryMeta>;

export const CATEGORY_ORDER: readonly FeedbackCategory[] = FEEDBACK_CATEGORIES;

export const IMPACT_HINTS: Record<FeedbackImpact, string> = {
  LOW: "Small annoyance.",
  MEDIUM: "Slows me down.",
  HIGH: "Wrong result, or a lot of extra work.",
  CRITICAL: "I can't do my work.",
};

/*
 * The hint and the icon travel with the option: they are the whole reason a
 * row of choices beats a dropdown, which hides both behind a click.
 */
export const CATEGORY_OPTIONS = FEEDBACK_CATEGORIES.map((value) => ({
  value,
  label: FEEDBACK_CATEGORY_LABELS[value],
  hint: CATEGORY_DETAILS[value].hint,
  icon: CATEGORY_DETAILS[value].icon,
}));

export const IMPACT_OPTIONS = FEEDBACK_IMPACTS.map((value) => ({
  value,
  label: FEEDBACK_IMPACT_LABELS[value],
  hint: IMPACT_HINTS[value],
}));
