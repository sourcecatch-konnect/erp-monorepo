"use client";

import { useEffect } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FEEDBACK_SEVERITIES,
  FEEDBACK_SEVERITY_LABELS,
  FEEDBACK_STATUSES,
  FEEDBACK_STATUS_LABELS,
  feedbackTriageSchema,
} from "@skerp/validators";
import {
  formatFeedbackNumber,
  type FeedbackDetail,
  type FeedbackTriageInput,
} from "@skerp/types";
import SelectField from "@/features/masters/_shared/fields/SelectField";
import TextField from "@/features/masters/_shared/fields/TextField";
import TextAreaField from "@/features/masters/_shared/fields/TextAreaField";
import { feedbackKeys } from "../feedback.keys";
import { feedbackApi } from "../feedback.service";

const STATUS_OPTIONS = FEEDBACK_STATUSES.map((value) => ({
  value,
  label: FEEDBACK_STATUS_LABELS[value],
}));
const SEVERITY_OPTIONS = FEEDBACK_SEVERITIES.map((value) => ({
  value,
  label: FEEDBACK_SEVERITY_LABELS[value],
}));

const toDefaults = (item: FeedbackDetail): FeedbackTriageInput => ({
  status: item.status,
  severity: item.severity ?? "",
  assignee: item.assignee ?? "",
  externalRef: item.externalRef ?? "",
  devNotes: item.devNotes ?? "",
});

/** Team-side fields. Submitted by the "Save changes" button in the sheet footer (form={formId}). */
export function TriageForm({
  item,
  formId,
  onSavingChange,
}: {
  item: FeedbackDetail;
  formId: string;
  onSavingChange: (saving: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const methods = useForm<FeedbackTriageInput>({
    // raw: true — the server parse is the only "" → null transform.
    resolver: zodResolver(feedbackTriageSchema, undefined, { raw: true }),
    defaultValues: toDefaults(item),
  });

  useEffect(() => methods.reset(toDefaults(item)), [item, methods]);

  const save = useMutation({
    mutationFn: (body: FeedbackTriageInput) => feedbackApi.triage(item.id, body),
    onMutate: () => onSavingChange(true),
    onSettled: () => onSavingChange(false),
    onSuccess: (updated) => {
      toast.success(`${formatFeedbackNumber(updated.number)} updated`);
      void queryClient.invalidateQueries({ queryKey: feedbackKeys.all });
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <FormProvider {...methods}>
      <form
        id={formId}
        onSubmit={methods.handleSubmit((values) => save.mutate(values))}
        className="grid gap-4 sm:grid-cols-2"
        noValidate
      >
        <SelectField<FeedbackTriageInput>
          name="status"
          label="Status"
          options={STATUS_OPTIONS}
          required
        />
        <SelectField<FeedbackTriageInput>
          name="severity"
          label="Severity"
          options={SEVERITY_OPTIONS}
          placeholder="Not set"
        />
        <TextField<FeedbackTriageInput>
          name="assignee"
          label="Assigned to"
          placeholder="Developer name"
        />
        <TextField<FeedbackTriageInput>
          name="externalRef"
          label="Jira key"
          placeholder="e.g. ERP-123"
        />
        <div className="sm:col-span-2">
          <TextAreaField<FeedbackTriageInput>
            name="devNotes"
            label="Developer notes"
            placeholder="What was found, what was changed, or why it won't be fixed."
            rows={4}
          />
        </div>
      </form>
    </FormProvider>
  );
}
