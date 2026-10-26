import {
  IconArrowsShuffle,
  IconBug,
  IconBulb,
  IconLayout,
  IconSearch,
  type Icon,
} from "@tabler/icons-react";
import type { FeedbackCategory } from "@skerp/types";

/** How each feedback type is introduced to the person reporting it. */
export type CategoryMeta = {
  value: FeedbackCategory;
  title: string;
  hint: string;
  icon: Icon;
  /** Example shown in the "Short title" box. */
  titleExample: string;
};

export const CATEGORY_META: Record<FeedbackCategory, CategoryMeta> = {
  BUG: {
    value: "BUG",
    title: "Something is not working",
    hint: "An error, a wrong number, or a button that does nothing.",
    icon: IconBug,
    titleExample: "e.g. Save button does nothing on the LR form",
  },
  FLOW: {
    value: "FLOW",
    title: "The process is wrong",
    hint: "The steps don't match how we actually work at SK.",
    icon: IconArrowsShuffle,
    titleExample: "e.g. Order should be approved before LRs are made",
  },
  UI: {
    value: "UI",
    title: "The screen needs a change",
    hint: "Hard to read, confusing, or too many clicks.",
    icon: IconLayout,
    titleExample: "e.g. Freight total is hard to see",
  },
  FINDABILITY: {
    value: "FINDABILITY",
    title: "I can't find something",
    hint: "A screen, button or report was hard to find.",
    icon: IconSearch,
    titleExample: "e.g. Couldn't find where to print the LR",
  },
  SUGGESTION: {
    value: "SUGGESTION",
    title: "I have an idea",
    hint: "Something new that would make work easier.",
    icon: IconBulb,
    titleExample: "e.g. Show the customer's outstanding amount on the order",
  },
};

export const CATEGORY_ORDER: FeedbackCategory[] = [
  "BUG",
  "FLOW",
  "UI",
  "FINDABILITY",
  "SUGGESTION",
];
