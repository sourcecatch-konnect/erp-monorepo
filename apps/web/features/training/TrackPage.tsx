"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  IconArrowLeft,
  IconArrowRight,
  IconBook2,
  IconCheck,
  IconCircleCheck,
  IconExternalLink,
  IconListCheck,
  type Icon,
} from "@tabler/icons-react";
import type { TrainingProgressEntry, TrainingStep } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { cn } from "@skerp/ui/lib/util";
import { useBreadcrumbLabels } from "@/components/layout/breadcrumb-labels";
import { LESSON_CONTENT, type LessonContent } from "./content/lessons";
import { LessonList, type LessonListItem } from "./components/LessonList";
import { LessonReference } from "./components/LessonReference";
import { LessonStepper } from "./components/LessonStepper";
import { ProgressRing } from "./components/ProgressRing";
import { QuizPanel } from "./components/QuizPanel";
import {
  useStepProgress,
  useTrainingMe,
  useVerifyTrack,
} from "./hooks/useTraining";
import {
  TRACK_BY_KEY,
  findTrackView,
  progressMap,
  trackProgress,
  type TrackProgress,
} from "./lib/catalog-lookup";

/** A step with no written lesson still reads as one, just a shorter one. */
const fallbackContent = (trackTitle: string): LessonContent => ({
  group: trackTitle,
  icon: IconBook2,
  does: [],
});

function LessonBody({
  step,
  content,
  index,
  total,
  entry,
}: {
  step: TrainingStep;
  content: LessonContent;
  index: number;
  total: number;
  entry: TrainingProgressEntry | undefined;
}) {
  const LessonIcon: Icon = content.icon;

  return (
    <div className="space-y-5 px-5 pt-5">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-tight text-primary">
          Lesson {index + 1} of {total} · {content.group}
        </p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="flex items-center gap-2.5 text-xl font-semibold tracking-tight text-foreground">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <LessonIcon className="size-[18px]" aria-hidden />
            </span>
            {step.title}
          </h1>
          {step.href ? (
            <Button asChild variant="outline">
              <Link href={step.href}>
                <IconExternalLink className="size-4" aria-hidden />
                Open the screen
              </Link>
            </Button>
          ) : null}
        </div>
        <p className="max-w-[66ch] text-sm text-muted-foreground">
          {content.intro ?? step.summary}
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-8">
        {content.does.length > 0 ? (
          <div>
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-tight text-muted-foreground">
              <IconArrowRight className="size-3.5" aria-hidden />
              Do this, in this order
            </p>
            <ol>
              {content.does.map((action, actionIndex) => {
                const ActionIcon: Icon = action.icon;
                const last = actionIndex === content.does.length - 1;
                return (
                  <li key={action.title} className="relative flex gap-3 pb-4">
                    {!last ? (
                      <span
                        aria-hidden
                        className="absolute bottom-0 left-[14px] top-[30px] w-0.5 bg-border"
                      />
                    ) : null}
                    <span className="relative z-[1] flex size-[30px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <ActionIcon className="size-[15px]" aria-hidden />
                      <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full border border-primary bg-card text-[10px] font-bold text-primary">
                        {actionIndex + 1}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-foreground">
                        {action.title}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {action.detail}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : (
          <div className="flex items-start gap-2.5 self-start rounded-md border border-dashed border-border bg-background px-4 py-3">
            <IconListCheck
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <p className="text-sm text-muted-foreground">
              Open the screen, try it once, then come back and mark this lesson
              done.
            </p>
          </div>
        )}

        <LessonReference content={content} />
      </div>

      {entry?.completedBy === "SYSTEM" ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <IconCircleCheck className="size-3.5 text-success" aria-hidden />
          The ERP saw that you have already done this, so it was ticked for you.
        </p>
      ) : null}
    </div>
  );
}

function LessonShell({ progress }: { progress: TrackProgress }) {
  const me = useTrainingMe().data;
  const entries = useMemo(
    () => (me ? progressMap(me) : new Map<string, TrainingProgressEntry>()),
    [me],
  );
  const saveProgress = useStepProgress();

  const lessons = useMemo(
    () =>
      progress.steps.map((step) => ({
        step,
        content:
          LESSON_CONTENT[step.key] ?? fallbackContent(progress.track.title),
      })),
    [progress.steps, progress.track.title],
  );

  const firstOpenIndex = Math.max(
    0,
    progress.steps.findIndex((step) => !entries.has(step.key)),
  );
  const [index, setIndex] = useState(firstOpenIndex);
  const bounded = Math.min(index, Math.max(0, lessons.length - 1));
  const lesson = lessons[bounded];

  if (!lesson) return null;

  const entry = entries.get(lesson.step.key);
  const busy =
    saveProgress.isPending &&
    saveProgress.variables?.stepKey === lesson.step.key;
  const last = bounded === lessons.length - 1;

  const items: LessonListItem[] = lessons.map(({ step, content }) => {
    const stepEntry = entries.get(step.key);
    return {
      key: step.key,
      title: step.title,
      group: content.group,
      icon: content.icon,
      done: stepEntry?.status === "DONE",
      skipped: stepEntry?.status === "SKIPPED",
    };
  });

  const markDoneAndMove = () => {
    if (!entry)
      saveProgress.mutate({ stepKey: lesson.step.key, status: "DONE" });
    if (!last) setIndex(bounded + 1);
  };

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-4 py-3.5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">
            {progress.track.title}
          </h2>
          <p className="text-xs text-muted-foreground">
            {progress.total} lessons · {progress.track.description}
          </p>
        </div>
        <ProgressRing
          percent={progress.percent}
          label={`${progress.track.title} progress`}
        />
      </div>

      <div className="grid md:grid-cols-[17rem_minmax(0,1fr)]">
        <LessonList
          items={items}
          currentIndex={bounded}
          finished={progress.finished}
          total={progress.total}
          percent={progress.percent}
          onPick={setIndex}
        />

        <div>
          <LessonStepper
            items={items.map((item) => ({
              key: item.key,
              title: item.title,
              done: item.done,
            }))}
            currentIndex={bounded}
            onPick={setIndex}
          />

          <LessonBody
            step={lesson.step}
            content={lesson.content}
            index={bounded}
            total={lessons.length}
            entry={entry}
          />

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2.5 border-t border-border bg-background px-5 py-3">
            <Button
              variant="outline"
              disabled={bounded === 0}
              onClick={() => setIndex(bounded - 1)}
            >
              <IconArrowLeft className="size-4" aria-hidden />
              Previous
            </Button>

            <span className="text-xs text-muted-foreground">
              Lesson {bounded + 1} of {lessons.length}
            </span>

            <div className="flex flex-wrap items-center gap-2">
              {entry ? (
                <>
                  {entry.completedBy === "SELF" ? (
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        saveProgress.mutate({
                          stepKey: lesson.step.key,
                          status: null,
                        })
                      }
                    >
                      Undo
                    </Button>
                  ) : null}
                  <Button
                    variant={last ? "outline" : "default"}
                    disabled={last}
                    onClick={() => setIndex(bounded + 1)}
                  >
                    Next lesson
                    <IconArrowRight className="size-4" aria-hidden />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      saveProgress.mutate({
                        stepKey: lesson.step.key,
                        status: "SKIPPED",
                      })
                    }
                  >
                    Skip
                  </Button>
                  <Button disabled={busy} onClick={markDoneAndMove}>
                    <IconCheck className="size-4" aria-hidden />
                    {last ? "Mark done & finish" : "Mark done & next"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A4 — one role track, as lessons: the list beside one lesson at a time. */
export function TrackPage({ trackKey }: { trackKey: string }) {
  const { data: me, isLoading, isError, error } = useTrainingMe();
  const { setLabel } = useBreadcrumbLabels();
  const catalogTrack = TRACK_BY_KEY.get(trackKey);

  useEffect(() => {
    const href = `/training/${trackKey}`;
    setLabel(href, catalogTrack?.title ?? null);
    return () => setLabel(href, null);
  }, [trackKey, catalogTrack?.title, setLabel]);

  const view = me ? findTrackView(me, trackKey) : undefined;
  useVerifyTrack(trackKey, view !== undefined);
  const progress = me && view ? trackProgress(view, progressMap(me)) : null;

  return (
    <div className="w-full space-y-5">
      <Link
        href="/training"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground"
      >
        <IconArrowLeft className="size-4" aria-hidden />
        Back to My role &amp; training
      </Link>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-[28rem] w-full" />
        </div>
      ) : null}

      {isError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          We couldn&apos;t load this training: {error.message}
        </p>
      ) : null}

      {me && !progress ? (
        <div className="rounded-md border border-border bg-card px-5 py-10 text-center">
          <p className="text-sm font-medium text-foreground">
            This training isn&apos;t part of your role
          </p>
          <p className="text-sm text-muted-foreground">
            Go back to My role &amp; training to see the ones meant for you.
          </p>
        </div>
      ) : null}

      {progress ? (
        <>
          {progress.current === undefined ? (
            <div
              className={cn(
                "flex items-start gap-3 rounded-md border border-success/30 px-4 py-3",
                "bg-success/5",
              )}
            >
              <IconCircleCheck
                className="mt-0.5 size-5 shrink-0 text-success"
                aria-hidden
              />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  You have finished this training
                </p>
                <p className="text-sm text-muted-foreground">
                  Well done. Come back to any lesson whenever you need a
                  reminder.
                </p>
              </div>
            </div>
          ) : null}

          <LessonShell progress={progress} />

          <QuizPanel
            trackKey={progress.track.key}
            primary={progress.current === undefined}
          />
        </>
      ) : null}
    </div>
  );
}
