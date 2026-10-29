"use client";

import { useEffect, useState } from "react";
import { FormProvider, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { IconAlertTriangle, IconHandFinger, IconInfoCircle } from "@tabler/icons-react";
import { FEEDBACK_MAX_FILES, feedbackFormSchema } from "@skerp/validators";
import {
  describeUserAgent,
  type FeedbackCreated,
  type FeedbackFormInput,
} from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { useAuth } from "@/features/auth";
import TextAreaField from "@/features/masters/_shared/fields/TextAreaField";
import {
  CATEGORY_OPTIONS,
  IMPACT_OPTIONS,
} from "../categories";
import { feedbackApi } from "../feedback.service";
import {
  EMPTY_FEEDBACK_VALUES,
  restoreDraft,
  type FeedbackFormValues,
} from "../form-values";
import { snapshotActivity } from "../lib/activity-recorder";
import { clearDraft, loadDraft, saveDraft } from "../lib/draft";
import type { PageAttachments, PendingFile, VoiceNote } from "../lib/files";
import { describeClient, type PageInfo } from "../lib/page-context";
import { listPageSections } from "../lib/page-sections";
import { AttachmentsSection, toPendingFiles } from "./AttachmentsSection";
import { ChoiceField } from "./ChoiceField";
import { QuestionFields } from "./QuestionFields";
import { PointsField } from "./PointsField";
import { SectionField } from "./SectionField";
import { VoiceRecorder } from "./VoiceRecorder";

// The form state keeps "" for "not chosen"; the shared schema turns it into
// the parsed submit shape (empty points dropped, type required).
const resolver = zodResolver(
  feedbackFormSchema,
) as unknown as Resolver<FeedbackFormValues>;

const clip = (text: string, max: number) => text.slice(0, max);

function WhatWeAttach({ page }: { page: PageInfo }) {
  const { user } = useAuth();
  const errorCount = (snapshotActivity().recentApi ?? []).filter(
    (call) => call.status === null || call.status >= 400,
  ).length;
  const rows: [string, string][] = [
    ["Page", `${page.title} (${page.path})`],
    [
      "Your name and role",
      user ? `${user.firstName} ${user.lastName} · ${user.role.name}` : "—",
    ],
    ["Browser", describeUserAgent(navigator.userAgent)],
    ["App version", process.env.NEXT_PUBLIC_APP_VERSION || "Not set"],
    ["Recent errors on screen", errorCount === 0 ? "None" : String(errorCount)],
  ];
  return (
    <details className="rounded-md border border-border bg-card px-4 py-3">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
        <IconInfoCircle className="size-4 text-muted-foreground" aria-hidden />
        What we attach automatically
      </summary>
      <p className="mt-2 text-xs text-muted-foreground">
        So you don&apos;t have to explain where you were, we send these details with
        your feedback. We never send passwords or what you typed into other
        screens.
      </p>
      <dl className="mt-3 grid gap-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-0.5 sm:grid-cols-[180px_1fr]">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="break-words text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/**
 * Give feedback: one short form, the same on every page. The page, the person
 * and the technical trail are attached automatically; the files and voice
 * note are held by the sheet and uploaded once the item exists.
 */
export function FeedbackForm({
  page,
  attachments,
  uploadsEnabled,
  onFilesChange,
  onVoiceChange,
  onElementChange,
  onPoint,
  onSent,
  onClose,
}: {
  page: PageInfo;
  attachments: PageAttachments;
  uploadsEnabled: boolean;
  onFilesChange: (files: PendingFile[]) => void;
  onVoiceChange: (note: VoiceNote | null) => void;
  onElementChange: (element: null) => void;
  /** Hide the panel and let the user click the part of the screen. */
  onPoint: () => void;
  onSent: (created: FeedbackCreated) => void;
  onClose: () => void;
}) {
  const { files, voice, element } = attachments;
  // Read once per opening: the panel covers the page while it is open.
  const [sections] = useState(listPageSections);

  const methods = useForm<FeedbackFormValues>({
    resolver,
    mode: "onTouched",
    defaultValues: {
      ...restoreDraft(loadDraft<FeedbackFormValues>(page.path)),
      hasVoiceNote: voice !== null,
    },
  });
  const category = methods.watch("category");

  // Unsent text survives closing the panel (per page). restoreDraft ignores the
  // voice flag: the recording itself only lives in memory.
  useEffect(() => {
    const subscription = methods.watch((values) => saveDraft(page.path, values));
    return () => subscription.unsubscribe();
  }, [methods, page.path]);

  useEffect(() => {
    methods.setValue("hasVoiceNote", voice !== null);
    if (methods.formState.isSubmitted) void methods.trigger();
  }, [methods, voice]);

  const submit = useMutation({
    mutationFn: (feedback: FeedbackFormInput) =>
      feedbackApi.submit({
        feedback,
        page: {
          path: clip(page.path, 300),
          title: clip(page.title, 160),
          module: clip(page.module, 160),
          ...(page.entityId ? { entityId: page.entityId } : {}),
        },
        context: {
          ...describeClient(),
          breadcrumb: page.breadcrumb.slice(0, 12).map((item) => clip(item, 160)),
          ...snapshotActivity(),
          ...(element ? { element } : {}),
          attachmentsPlanned: {
            voice: uploadsEnabled && voice !== null,
            images: uploadsEnabled ? files.filter((file) => file.kind === "image").length : 0,
            documents: uploadsEnabled ? files.filter((file) => file.kind === "document").length : 0,
          },
        },
      }),
    onSuccess: (created) => {
      clearDraft(page.path);
      methods.reset(EMPTY_FEEDBACK_VALUES);
      onSent(created);
    },
  });

  const onSubmit = methods.handleSubmit((values) =>
    // Resolver output is the parsed schema value (empty points already dropped).
    submit.mutate(values as unknown as FeedbackFormInput),
  );

  // Ctrl+V of a screenshot anywhere in the form adds it as a picture.
  const onPaste = (event: React.ClipboardEvent<HTMLFormElement>) => {
    if (!uploadsEnabled || files.length >= FEEDBACK_MAX_FILES) return;
    const pasted = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    if (pasted.length === 0) return;
    event.preventDefault();
    void toPendingFiles(pasted, FEEDBACK_MAX_FILES - files.length).then((added) => {
      if (added.length > 0) onFilesChange([...files, ...added]);
    });
  };

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={onSubmit}
        onPaste={onPaste}
        className="flex min-h-0 flex-1 flex-col"
        noValidate
      >
        <div className="@container flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          {/*
           * Choices are rows, not dropdowns. Every type and every impact level
           * is readable at a glance with its plain-language hint, and each row
           * is a large tap target — this form is used on phones, in a yard,
           * by people who are not going to open a dropdown to read their
           * options one at a time.
           */}
          <ChoiceField
            name="category"
            label="What kind of problem is it?"
            options={CATEGORY_OPTIONS}
            columns={2}
            required
          />

          {/*
           * Everything below depends on the type, so none of it is shown until
           * a type is chosen. Opening this panel on a wall of empty fields is
           * what makes people close it again; one question is answerable.
           */}
          {category ? (
            <>
              <ChoiceField
                name="impact"
                label="How much does it affect your work?"
                options={IMPACT_OPTIONS}
                compact
                required
              />

              {/*
               * Pointing lives in "Show us" when pictures are available, so the
               * action appears once. With uploads off there is no "Show us", and
               * pointing is still worth offering: it fills in the section name.
               */}
              <SectionField
                sections={sections}
                canPoint={!uploadsEnabled}
                onPoint={onPoint}
              />

          {element ? (
            <p className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <IconHandFinger className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">
                You pointed at:{" "}
                <span className="font-medium text-foreground">
                  {element.text ? `"${element.text}"` : `a ${element.tag} element`}
                </span>
              </span>
              <button
                type="button"
                className="shrink-0 text-primary transition-colors duration-150 hover:underline"
                onClick={() => onElementChange(null)}
              >
                Clear
              </button>
            </p>
          ) : null}

              {/* The questions for the chosen type carry most of the report. */}
              <QuestionFields category={category} />

              <TextAreaField<FeedbackFormValues>
                name="description"
                label="Anything else we should know?"
                placeholder="Add anything the questions above didn't cover…"
                rows={3}
                maxLength={4000}
              />

              <PointsField />

              {uploadsEnabled ? (
                <div className="grid gap-4 @xl:grid-cols-2">
                  <VoiceRecorder note={voice} onChange={onVoiceChange} />
                  <AttachmentsSection
                    files={files}
                    onFilesChange={onFilesChange}
                    onElementRemoved={() => onElementChange(null)}
                    onPoint={onPoint}
                  />
                </div>
              ) : (
                <p className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                  Voice notes and attachments aren&apos;t set up on this server
                  yet. You can still send text and points.
                </p>
              )}

              <WhatWeAttach page={page} />
            </>
          ) : null}

          {submit.isError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              <IconAlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                We couldn&apos;t send your feedback: {submit.error.message}. Everything
                you added is still here, so please try again.
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 border-t border-border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-end sm:px-6 sm:pb-4">
          <Button
            type="button"
            variant="outline"
            className="max-sm:h-11 max-sm:flex-1"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="max-sm:h-11 max-sm:flex-1"
            disabled={submit.isPending}
          >
            {submit.isPending ? "Sending…" : "Submit feedback"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
