"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { FormProvider, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconInfoCircle,
  IconMapPin,
} from "@tabler/icons-react";
import {
  FEEDBACK_MAX_SCREENSHOTS,
  feedbackFormSchema,
} from "@skerp/validators";
import {
  describeUserAgent,
  formatFeedbackNumber,
  type FeedbackCategory,
  type FeedbackElement,
  type FeedbackFormInput,
} from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@skerp/ui/components/tabs";
import { useAuth } from "@/features/auth";
import { useBreadcrumbLabels } from "@/components/layout/breadcrumb-labels";
import { CATEGORY_META, CATEGORY_ORDER } from "../categories";
import { feedbackKeys } from "../feedback.keys";
import { feedbackApi } from "../feedback.service";
import { EMPTY_FEEDBACK_VALUES, type FeedbackFormValues } from "../form-values";
import { snapshotActivity } from "../lib/activity-recorder";
import { releaseVoiceNote, type VoiceNote } from "../lib/voice-note";
import { VoiceNoteSection } from "./VoiceNoteSection";
import { clearDraft, loadDraft, saveDraft } from "../lib/draft";
import {
  fileToScreenshot,
  releaseScreenshot,
  type Screenshot,
} from "../lib/images";
import {
  describeClient,
  describePage,
  type PageInfo,
} from "../lib/page-context";
import { CategoryFields } from "./CategoryFields";
import { ScreenshotSection } from "./ScreenshotSection";

// The flat form state holds every tab's fields; the shared discriminated-union
// schema validates the active tab and returns only its fields.
const resolver = zodResolver(
  feedbackFormSchema,
) as unknown as Resolver<FeedbackFormValues>;

// Large, readable tiles on top of the shared Tabs primitive (keeps tab
// semantics + arrow-key navigation). Overrides the default pill styling.
// Radix marks the selected tab with data-state="active" (the shared Tabs'
// `data-active:` classes never match it), so select on that directly.
const TILE_CLASS =
  "h-auto w-full flex-none items-start justify-start gap-3 whitespace-normal border-border px-3 py-3 text-left text-foreground transition-colors duration-150 hover:bg-muted dark:text-foreground data-[state=active]:border-primary data-[state=active]:bg-primary/5 dark:data-[state=active]:bg-primary/10";

const clip = (text: string, max: number) => text.slice(0, max);

function StepHeading({ step, title }: { step: number; title: string }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
      <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {step}
      </span>
      {title}
    </h3>
  );
}

function PageBanner({ page }: { page: PageInfo }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-muted/40 px-4 py-3">
      <IconMapPin className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">
          You are giving feedback about this page
        </p>
        <p className="truncate text-sm font-semibold text-foreground">
          {page.title}
          {page.entityLabel ? ` · ${page.entityLabel}` : ""}
        </p>
        <p className="truncate text-xs text-muted-foreground">{page.module}</p>
      </div>
    </div>
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
    <details className="rounded-md border border-border bg-card px-4 py-3">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
        <IconInfoCircle className="size-4 text-muted-foreground" aria-hidden />
        What we attach automatically
      </summary>
      <p className="mt-2 text-xs text-muted-foreground">
        So you don&apos;t have to explain where you were, we send these details
        with your feedback. We never send passwords or what you typed into other
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

function SentConfirmation({
  number,
  failedPictures,
  failedVoiceNotes,
  onAnother,
  onClose,
}: {
  number: number;
  failedPictures: number;
  failedVoiceNotes: number;
  onAnother: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <IconCircleCheck className="size-7" aria-hidden />
      </span>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">
          Thank you, your feedback has been sent
        </h3>
        <p className="text-sm text-muted-foreground">
          Your reference number is{" "}
          <span className="font-semibold text-foreground">
            {formatFeedbackNumber(number)}
          </span>
          . You can follow its progress under <strong>My feedback</strong>.
        </p>
        {failedPictures > 0 ? (
          <p className="text-sm text-destructive">
            {failedPictures} picture{failedPictures === 1 ? "" : "s"} could not
            be attached. Your feedback was still sent.
          </p>
        ) : null}
        {failedVoiceNotes > 0 ? (
          <p className="text-sm text-destructive">
            {failedVoiceNotes} voice note{failedVoiceNotes === 1 ? "" : "s"}{" "}
            could not be attached. Your feedback was still sent.
          </p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onAnother}>
          Send another
        </Button>
        <Button onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}

/** Upload each picture: presign → PUT to storage → confirm. Returns how many failed. */
async function uploadScreenshots(
  feedbackId: string,
  shots: Screenshot[],
): Promise<number> {
  let failed = 0;
  for (const shot of shots) {
    try {
      const { attachmentId, uploadUrl } = await feedbackApi.requestScreenshot(
        feedbackId,
        {
          mime: "image/jpeg",
          sizeBytes: shot.blob.size,
          width: shot.width,
          height: shot.height,
        },
      );
      await feedbackApi.uploadToStorage(uploadUrl, shot.blob);
      await feedbackApi.completeScreenshot(feedbackId, attachmentId);
    } catch {
      failed += 1;
    }
  }
  return failed;
}

/** Same three steps for each voice note. Returns how many failed. */
async function uploadVoiceNotes(
  feedbackId: string,
  notes: VoiceNote[],
): Promise<number> {
  let failed = 0;
  for (const note of notes) {
    try {
      const { attachmentId, uploadUrl } = await feedbackApi.requestVoiceNote(
        feedbackId,
        {
          mime: note.mime,
          sizeBytes: note.blob.size,
          durationSeconds: note.durationSeconds,
        },
      );
      await feedbackApi.uploadToStorage(uploadUrl, note.blob);
      await feedbackApi.completeVoiceNote(feedbackId, attachmentId);
    } catch {
      failed += 1;
    }
  }
  return failed;
}

export function FeedbackForm({
  onClose,
  screenshotsEnabled,
  voiceNotesEnabled,
  shots,
  notes,
  element,
  onShotsChange,
  onNotesChange,
  onElementChange,
  onPick,
}: {
  onClose: () => void;
  screenshotsEnabled: boolean;
  voiceNotesEnabled: boolean;
  shots: Screenshot[];
  notes: VoiceNote[];
  element: FeedbackElement | null;
  onShotsChange: (shots: Screenshot[]) => void;
  onNotesChange: (notes: VoiceNote[]) => void;
  onElementChange: (element: FeedbackElement | null) => void;
  onPick: () => void;
}) {
  const pathname = usePathname();
  const { labels } = useBreadcrumbLabels();
  const page = useMemo(
    () => describePage(pathname, labels),
    [pathname, labels],
  );
  const queryClient = useQueryClient();
  const [sent, setSent] = useState<{
    number: number;
    failedPictures: number;
    failedVoiceNotes: number;
  } | null>(null);

  const methods = useForm<FeedbackFormValues>({
    resolver,
    mode: "onTouched",
    defaultValues: {
      ...EMPTY_FEEDBACK_VALUES,
      ...loadDraft<FeedbackFormValues>(page.path),
    },
  });
  const category = methods.watch("category");

  useEffect(() => {
    const subscription = methods.watch((values) =>
      saveDraft(page.path, values),
    );
    return () => subscription.unsubscribe();
  }, [methods, page.path]);

  const submit = useMutation({
    mutationFn: async (feedback: FeedbackFormInput) => {
      const created = await feedbackApi.submit({
        feedback,
        page: {
          path: clip(page.path, 300),
          title: clip(page.title, 160),
          module: clip(page.module, 160),
          ...(page.entityId ? { entityId: page.entityId } : {}),
        },
        context: {
          ...describeClient(),
          breadcrumb: page.breadcrumb
            .slice(0, 12)
            .map((item) => clip(item, 160)),
          ...snapshotActivity(),
          ...(element ? { element } : {}),
        },
      });
      // The feedback is saved first; a failed attachment never loses the report.
      const failedPictures = await uploadScreenshots(created.id, shots);
      const failedVoiceNotes = await uploadVoiceNotes(created.id, notes);
      return { ...created, failedPictures, failedVoiceNotes };
    },
    onSuccess: (created) => {
      clearDraft(page.path);
      shots.forEach(releaseScreenshot);
      notes.forEach(releaseVoiceNote);
      onShotsChange([]);
      onNotesChange([]);
      onElementChange(null);
      setSent({
        number: created.number,
        failedPictures: created.failedPictures,
        failedVoiceNotes: created.failedVoiceNotes,
      });
      void queryClient.invalidateQueries({ queryKey: feedbackKeys.mine });
    },
  });

  const chooseCategory = (value: string) => {
    methods.setValue("category", value as FeedbackCategory);
    methods.clearErrors();
  };

  const onSubmit = methods.handleSubmit((values) =>
    // Resolver output is the parsed union: only the active tab's fields.
    submit.mutate(values as unknown as FeedbackFormInput),
  );

  // Ctrl+V of a screenshot anywhere in the form adds it as a picture.
  const onPaste = (event: React.ClipboardEvent<HTMLFormElement>) => {
    if (!screenshotsEnabled || shots.length >= FEEDBACK_MAX_SCREENSHOTS) return;
    const file = Array.from(event.clipboardData.items)
      .find((item) => item.type.startsWith("image/"))
      ?.getAsFile();
    if (!file) return;
    event.preventDefault();
    fileToScreenshot(file)
      .then((shot) => onShotsChange([...shots, shot]))
      .catch((error: unknown) =>
        toast.error(
          error instanceof Error
            ? error.message
            : "We couldn't add that picture.",
        ),
      );
  };

  if (sent !== null) {
    return (
      <SentConfirmation
        number={sent.number}
        failedPictures={sent.failedPictures}
        failedVoiceNotes={sent.failedVoiceNotes}
        onClose={onClose}
        onAnother={() => {
          methods.reset(EMPTY_FEEDBACK_VALUES);
          submit.reset();
          setSent(null);
        }}
      />
    );
  }

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={onSubmit}
        onPaste={onPaste}
        className="flex min-h-0 flex-1 flex-col"
        noValidate
      >
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <PageBanner page={page} />

          <Tabs
            value={category}
            onValueChange={chooseCategory}
            className="gap-4"
          >
            <section className="space-y-3">
              <StepHeading step={1} title="What kind of feedback is it?" />
              <TabsList
                aria-label="Kind of feedback"
                className="grid h-auto w-full grid-cols-1 gap-2 rounded-none bg-transparent p-0 group-data-horizontal/tabs:h-auto sm:grid-cols-2"
              >
                {CATEGORY_ORDER.map((value) => {
                  const meta = CATEGORY_META[value];
                  const TileIcon = meta.icon;
                  return (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className={TILE_CLASS}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <TileIcon className="size-5" aria-hidden />
                      </span>
                      <span className="grid gap-0.5">
                        <span className="text-sm font-semibold">
                          {meta.title}
                        </span>
                        <span className="text-xs font-normal text-muted-foreground">
                          {meta.hint}
                        </span>
                      </span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              {category === "" ? (
                <p className="text-sm text-muted-foreground">
                  Choose the one that fits best. You can change it at any time.
                </p>
              ) : null}
            </section>

            {CATEGORY_ORDER.map((value) => (
              <TabsContent key={value} value={value} className="space-y-3">
                <StepHeading step={2} title="Tell us more" />
                <CategoryFields category={value} />
              </TabsContent>
            ))}
          </Tabs>

          {category !== "" && screenshotsEnabled ? (
            <ScreenshotSection
              shots={shots}
              element={element}
              onShotsChange={onShotsChange}
              onElementChange={onElementChange}
              onPick={onPick}
            />
          ) : null}

          {category !== "" && voiceNotesEnabled ? (
            <VoiceNoteSection notes={notes} onNotesChange={onNotesChange} />
          ) : null}

          {category !== "" ? <WhatWeAttach page={page} /> : null}

          {submit.isError ? (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <IconAlertTriangle
                className="mt-0.5 size-4 shrink-0"
                aria-hidden
              />
              <p>
                We couldn&apos;t send your feedback: {submit.error.message}.
                Your text is still here, so please try again.
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={category === "" || submit.isPending}>
            {submit.isPending ? "Sending…" : "Send feedback"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
