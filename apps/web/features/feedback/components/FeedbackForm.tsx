"use client";

import { useEffect, type ReactNode } from "react";
import { FormProvider, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import {
  IconAlertTriangle,
  IconCamera,
  IconClipboard,
  IconHandFinger,
  IconInfoCircle,
  IconMessage2,
  IconSend,
  type Icon,
} from "@tabler/icons-react";
import {
  FEEDBACK_MAX_DESCRIPTION_CHARS,
  FEEDBACK_MAX_FILES,
  feedbackFormSchema,
} from "@skerp/validators";
import {
  describeUserAgent,
  type FeedbackCreated,
  type FeedbackFormInput,
} from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Textarea } from "@skerp/ui/components/textarea";
import { useAuth } from "@/features/auth";
import { CATEGORY_OPTIONS, IMPACT_OPTIONS } from "../categories";
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
import { AttachmentsSection, toPendingFiles } from "./AttachmentsSection";
import { FeedbackSelect } from "./FeedbackSelect";
import { VoiceRecorder } from "./VoiceRecorder";

// The form state keeps "" for "not chosen"; the shared schema turns it into
// the parsed submit shape (empty points dropped, type required).
const resolver = zodResolver(
  feedbackFormSchema,
) as unknown as Resolver<FeedbackFormValues>;

const clip = (text: string, max: number) => text.slice(0, max);

/**
 * One titled band of the form. Two of these — what happened, and what it
 * looks like — are enough structure for a panel this size: a heading the eye
 * can land on, without the clicking a wizard costs.
 */
function Section({
  icon: SectionIcon,
  title,
  caption,
  optional,
  children,
}: {
  icon: Icon;
  title: string;
  caption: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <SectionIcon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {title}
            {optional ? (
              <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                Optional
              </span>
            ) : null}
          </h3>
          <p className="truncate text-xs text-muted-foreground">{caption}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

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
    <details className="rounded-lg border border-border bg-muted/30 px-4 py-3">
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
 * Give feedback: one page, two titled sections and one Send button.
 *
 * Everything is visible at once on purpose. The report is short enough that
 * splitting it across steps added clicks without removing anything from the
 * screen, and hid the voice note and the pictures behind a Next that people
 * never pressed. The page, the person and the technical trail are attached
 * automatically; the files and voice note are held by the sheet and uploaded
 * once the item exists.
 */
export function FeedbackForm({
  page,
  attachments,
  uploadsEnabled,
  capturing,
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
  /** A picture of the pointed-at part is still rendering. */
  capturing: boolean;
  onFilesChange: (files: PendingFile[]) => void;
  onVoiceChange: (note: VoiceNote | null) => void;
  onElementChange: (element: null) => void;
  /** Hide the panel and let the user click the part of the screen. */
  onPoint: () => void;
  onSent: (created: FeedbackCreated) => void;
  onClose: () => void;
}) {
  const { files, voice, element } = attachments;

  const methods = useForm<FeedbackFormValues>({
    resolver,
    mode: "onTouched",
    defaultValues: {
      ...restoreDraft(loadDraft<FeedbackFormValues>(page.path)),
      hasVoiceNote: voice !== null,
    },
  });
  const description = methods.watch("description") ?? "";
  const descriptionError = methods.formState.errors.description?.message;

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

  const addFiles = (incoming: File[]) => {
    const room = FEEDBACK_MAX_FILES - files.length;
    if (room <= 0) return;
    void toPendingFiles(incoming, room).then((added) => {
      if (added.length > 0) onFilesChange([...files, ...added]);
    });
  };

  /*
   * Ctrl+V of a screenshot works anywhere in the panel, not only while the
   * text box has focus: taking a screenshot moves focus away from the form,
   * so a paste handler bound to the form alone misses the one paste that
   * matters. Text pastes are untouched — only clipboard *files* are claimed.
   */
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (!uploadsEnabled || !event.clipboardData) return;
      const pasted = Array.from(event.clipboardData.items)
        .filter((item) => item.kind === "file")
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null);
      if (pasted.length === 0) return;
      event.preventDefault();
      addFiles(pasted);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // `files` is read inside addFiles, so the listener is rebound as it changes.
  });

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

  const send = methods.handleSubmit((values) =>
    // Resolver output is the parsed schema value (empty points already dropped).
    submit.mutate(values as unknown as FeedbackFormInput),
  );

  /*
   * The form has no submit button: Send is an ordinary button that calls
   * `send()` itself, and this handler only cancels the browser's own
   * submission. Keeping it that way means no keystroke and no nested control
   * that forgot `type="button"` can ever fire off a half-written report.
   */
  const onFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={onFormSubmit}
        className="flex min-h-0 flex-1 flex-col"
        noValidate
      >
        <div className="@container flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          <Section
            icon={IconMessage2}
            title="What happened?"
            caption="Two choices and a few lines are enough."
          >
            <div className="grid gap-4 @lg:grid-cols-2">
              <FeedbackSelect<FeedbackFormValues>
                name="category"
                label="What kind of problem is it?"
                placeholder="Choose a type"
                options={CATEGORY_OPTIONS}
                required
              />
              <FeedbackSelect<FeedbackFormValues>
                name="impact"
                label="How much does it affect your work?"
                options={IMPACT_OPTIONS}
                required
              />
            </div>

            <div className="grid gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <label
                  htmlFor="feedback-description"
                  className="text-xs font-medium text-muted-foreground"
                >
                  What should we know?
                </label>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {description.length} / {FEEDBACK_MAX_DESCRIPTION_CHARS}
                </span>
              </div>
              <Textarea
                id="feedback-description"
                rows={5}
                placeholder="Describe the issue, confusion or improvement…"
                maxLength={FEEDBACK_MAX_DESCRIPTION_CHARS}
                aria-invalid={Boolean(descriptionError)}
                className="h-[180px] min-h-[160px] max-h-[400px] resize-y rounded-xl"
                {...methods.register("description")}
              />
              {typeof descriptionError === "string" ? (
                <p className="text-xs text-destructive">{descriptionError}</p>
              ) : null}
            </div>
          </Section>

          <Section
            icon={IconCamera}
            title="Show us"
            caption="A picture or your voice says it faster than typing."
            optional
          >
            {uploadsEnabled ? (
              <>
                {/*
                 * Side by side on a wide panel, stretched to the same height:
                 * the sheet opens up to 3xl, and one card per row leaves half
                 * the drawer blank.
                 */}
                <div className="grid items-stretch gap-4 @lg:grid-cols-2">
                  <VoiceRecorder note={voice} onChange={onVoiceChange} />
                  <AttachmentsSection
                    files={files}
                    capturing={capturing}
                    onFilesChange={onFilesChange}
                    onElementRemoved={() => onElementChange(null)}
                    onPoint={onPoint}
                  />
                </div>
                <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                  <IconClipboard className="size-3.5 shrink-0" aria-hidden />
                  Took a screenshot? Press
                  <kbd className="rounded border border-border bg-muted px-1 font-sans text-[11px]">
                    Ctrl
                  </kbd>
                  +
                  <kbd className="rounded border border-border bg-muted px-1 font-sans text-[11px]">
                    V
                  </kbd>
                  anywhere in this panel to add it. You can also drag a file onto
                  the box above.
                </p>
              </>
            ) : (
              <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                Voice notes and attachments aren&apos;t set up on this server yet.
                What you wrote is enough — just press Send.
              </p>
            )}

            {element ? (
              <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
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
          </Section>

          {submit.isError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              <IconAlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                We couldn&apos;t send your feedback: {submit.error.message}. Everything
                you added is still here, so please try again.
              </p>
            </div>
          ) : null}

          {/* Pinned to the bottom, so leftover height sits above it. */}
          <div className="mt-auto pt-1">
            <WhatWeAttach page={page} />
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-end sm:px-6 sm:pb-4">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="max-sm:h-11 max-sm:flex-1"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="lg"
            className="max-sm:h-11 max-sm:flex-1"
            disabled={submit.isPending}
            onClick={() => void send()}
          >
            <IconSend className="size-4" aria-hidden />
            {submit.isPending ? "Sending…" : "Send feedback"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
