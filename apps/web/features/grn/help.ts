import type { PageHelpContent } from "@/features/training";

/** Help panel for GRN at Rail Head (A7). Review with Rail ops. */
export const GRN_HELP: PageHelpContent = {
  title: "GRN at Rail Head",
  purpose:
    "A GRN (Goods Receipt Note) records the goods actually received at the rail head, including any shortage or damage.",
  stage: "rail.rail-head",
  howTo: [
    "Press Create GRN and pick the LR or rake the goods came with.",
    "Count what really arrived and enter it, with any shortage or damage.",
    "Submit the GRN when the count is final.",
  ],
  next: "The goods move on to the destination branch, where a branch GRN is entered.",
  mistakes: [
    "Submitting before the goods are fully counted.",
    "Not recording damage at the rail head, which makes it hard to claim later.",
  ],
  terms: ["grn", "rake", "demurrage"],
  trainingStep: "rail.grn-rail-head",
};
