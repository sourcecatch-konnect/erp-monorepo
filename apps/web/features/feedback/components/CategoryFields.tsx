"use client";

import { useFormContext } from "react-hook-form";
import {
  FEEDBACK_FREQUENCY_LABELS,
  FEEDBACK_IMPACT_LABELS,
  FEEDBACK_UI_PROBLEM_LABELS,
} from "@skerp/validators";
import type { FeedbackCategory } from "@skerp/types";
import TextField from "@/features/masters/_shared/fields/TextField";
import TextAreaField from "@/features/masters/_shared/fields/TextAreaField";
import { CATEGORY_META } from "../categories";
import type { FeedbackFormValues } from "../form-values";
import { ChoiceField, type ChoiceOption } from "./ChoiceField";

const options = (labels: Record<string, string>): ChoiceOption[] =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

const SEVERITY_OPTIONS: ChoiceOption[] = [
  {
    value: "BLOCKER",
    label: "I can't continue my work",
    hint: "Work is stuck until this is fixed.",
  },
  {
    value: "MAJOR",
    label: "I can continue, but it's difficult",
    hint: "There is a way around it, but it costs time.",
  },
  {
    value: "MINOR",
    label: "It's a small problem",
    hint: "It looks wrong or is a little annoying.",
  },
];

function BugFields() {
  return (
    <>
      <TextAreaField<FeedbackFormValues>
        name="steps"
        label="What were you doing?"
        placeholder="e.g. I opened an LR, changed the freight amount and clicked Save."
        required
      />
      <TextAreaField<FeedbackFormValues>
        name="expected"
        label="What did you expect to happen?"
        placeholder="e.g. The LR should be saved with the new amount."
        rows={2}
        required
      />
      <TextAreaField<FeedbackFormValues>
        name="actual"
        label="What happened instead?"
        placeholder="e.g. Nothing happened, or an error message appeared (write what it said)."
        rows={2}
        required
      />
      <ChoiceField
        name="severity"
        label="How much does it affect your work?"
        options={SEVERITY_OPTIONS}
        required
      />
      <ChoiceField
        name="frequency"
        label="Does it happen every time? (optional)"
        options={options(FEEDBACK_FREQUENCY_LABELS)}
        columns={2}
      />
    </>
  );
}

function FlowFields() {
  return (
    <>
      <TextField<FeedbackFormValues>
        name="step"
        label="Which step or action is wrong?"
        placeholder="e.g. Approving an order"
        required
      />
      <TextAreaField<FeedbackFormValues>
        name="currentBehaviour"
        label="What does the system do now?"
        placeholder="e.g. It lets me create LRs before the order is approved."
        required
      />
      <TextAreaField<FeedbackFormValues>
        name="correctProcess"
        label="How is it actually done at SK?"
        placeholder="Describe the correct steps, in order."
        rows={4}
        required
      />
      <TextField<FeedbackFormValues>
        name="responsibleRole"
        label="Who should do this step? (optional)"
        placeholder="e.g. Branch Manager"
      />
      <ChoiceField
        name="impact"
        label="What is the effect? (optional)"
        options={options(FEEDBACK_IMPACT_LABELS)}
        columns={2}
      />
    </>
  );
}

function UiFields() {
  return (
    <>
      <TextField<FeedbackFormValues>
        name="element"
        label="Which part of the screen?"
        placeholder="e.g. The Total box on the Freight Details tab"
        required
      />
      <ChoiceField
        name="problem"
        label="What is the problem?"
        options={options(FEEDBACK_UI_PROBLEM_LABELS)}
        columns={2}
        required
      />
      <TextAreaField<FeedbackFormValues>
        name="suggestion"
        label="What would make it better?"
        placeholder="e.g. Show the total in bigger text at the top."
        required
      />
    </>
  );
}

function FindabilityFields() {
  const found = useFormContext<FeedbackFormValues>().watch("found");
  return (
    <>
      <TextField<FeedbackFormValues>
        name="lookingFor"
        label="What were you trying to find or do?"
        placeholder="e.g. Print the LR for the customer"
        required
      />
      <TextAreaField<FeedbackFormValues>
        name="lookedWhere"
        label="Where did you look, or expect it to be?"
        placeholder="e.g. I expected a Print button at the top of the LR."
        rows={2}
        required
      />
      <ChoiceField
        name="found"
        label="Did you find it in the end?"
        options={[
          { value: "YES", label: "Yes, I found it" },
          { value: "NO", label: "No, I couldn't find it" },
        ]}
        columns={2}
        required
      />
      {found === "YES" ? (
        <TextField<FeedbackFormValues>
          name="foundWhere"
          label="Where was it? (optional)"
          placeholder="e.g. Inside the ⋯ menu on the right"
        />
      ) : null}
    </>
  );
}

function SuggestionFields() {
  return (
    <>
      <TextAreaField<FeedbackFormValues>
        name="idea"
        label="Your idea"
        placeholder="Describe what you would like the ERP to do."
        rows={4}
        required
      />
      <TextAreaField<FeedbackFormValues>
        name="benefit"
        label="How will it help, and who? (optional)"
        placeholder="e.g. Accounts would not need to check a separate sheet."
        rows={2}
      />
    </>
  );
}

const FIELDS_BY_CATEGORY: Record<FeedbackCategory, () => React.JSX.Element> = {
  BUG: BugFields,
  FLOW: FlowFields,
  UI: UiFields,
  FINDABILITY: FindabilityFields,
  SUGGESTION: SuggestionFields,
};

/** Step 2 of the form: the title, the chosen tab's questions, and extras. */
export function CategoryFields({ category }: { category: FeedbackCategory }) {
  const Fields = FIELDS_BY_CATEGORY[category];
  return (
    <div className="space-y-4">
      <TextField<FeedbackFormValues>
        name="title"
        label="Short title"
        placeholder={CATEGORY_META[category].titleExample}
        required
      />
      <Fields />
      <TextAreaField<FeedbackFormValues>
        name="description"
        label="Anything else? (optional)"
        placeholder="Any other detail that may help the team."
        rows={2}
      />
    </div>
  );
}
