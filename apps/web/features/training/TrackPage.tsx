"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  IconArrowLeft,
  IconCheck,
  IconCircleCheck,
  IconExternalLink,
} from "@tabler/icons-react";
import type { TrainingProgressEntry, TrainingStep } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { cn } from "@skerp/ui/lib/util";
import { useBreadcrumbLabels } from "@/components/layout/breadcrumb-labels";
import { ProgressBar } from "./components/ProgressBar";
import { QuizPanel } from "./components/QuizPanel";
import { useStepProgress, useTrainingMe, useVerifyTrack } from "./hooks/useTraining";
import {
  TRACK_BY_KEY,
  findTrackView,
  progressMap,
  trackProgress,
} from "./lib/catalog-lookup";

function StepMarker({
  number,
  entry,
  current,
}: {
  number: number;
  entry: TrainingProgressEntry | undefined;
  current: boolean;
}) {
  if (entry?.status === "DONE") {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <IconCheck className="size-4" aria-hidden />
        <span className="sr-only">Done</span>
      </span>
    );
  }
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
        current
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground",
      )}
    >
      {number}
    </span>
  );
}

function StepItem({
  step,
  number,
  entry,
  current,
}: {
  step: TrainingStep;
  number: number;
  entry: TrainingProgressEntry | undefined;
  current: boolean;
}) {
  const progress = useStepProgress();
  const busy = progress.isPending && progress.variables?.stepKey === step.key;

  return (
    <li
      className={cn(
        "flex gap-4 rounded-md border bg-card p-4",
        current ? "border-primary" : "border-border",
      )}
      aria-current={current ? "step" : undefined}
    >
      <StepMarker number={number} entry={entry} current={current} />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{step.title}</p>
          {entry?.status === "DONE" ? (
            <span className="text-xs font-medium text-primary">
              {entry.completedBy === "SYSTEM" ? "Done automatically" : "Done"}
            </span>
          ) : null}
          {entry?.status === "SKIPPED" ? (
            <span className="text-xs font-medium text-muted-foreground">Skipped</span>
          ) : null}
          {current ? (
            <span className="text-xs font-medium text-primary">Your next step</span>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">{step.summary}</p>

        <div className="flex flex-wrap gap-2 pt-1">
          {step.href ? (
            <Button asChild variant="outline">
              <Link href={step.href}>
                <IconExternalLink className="size-4" aria-hidden />
                Open the screen
              </Link>
            </Button>
          ) : null}
          {entry?.completedBy === "SYSTEM" ? (
            <span className="self-center text-xs text-muted-foreground">
              The ERP saw that you have already done this.
            </span>
          ) : entry ? (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => progress.mutate({ stepKey: step.key, status: null })}
            >
              Undo
            </Button>
          ) : (
            <>
              <Button
                variant={current ? "default" : "outline"}
                disabled={busy}
                onClick={() => progress.mutate({ stepKey: step.key, status: "DONE" })}
              >
                <IconCheck className="size-4" aria-hidden />
                I&apos;ve done this
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => progress.mutate({ stepKey: step.key, status: "SKIPPED" })}
              >
                Skip
              </Button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

/** A4 — one role track as a checklist, saved per user. */
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
  const entries = me ? progressMap(me) : new Map<string, TrainingProgressEntry>();

  return (
    <div className="max-w-4xl space-y-6">
      <Link
        href="/training"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground"
      >
        <IconArrowLeft className="size-4" aria-hidden />
        Back to My role & training
      </Link>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
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
            Go back to My role & training to see the ones meant for you.
          </p>
        </div>
      ) : null}

      {progress ? (
        <>
          <header className="space-y-3">
            <div className="space-y-1">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                {progress.track.title}
              </h1>
              <p className="text-sm text-muted-foreground">{progress.track.description}</p>
            </div>
            <div className="flex max-w-md items-center gap-3">
              <ProgressBar percent={progress.percent} label={`${progress.track.title} progress`} />
              <span className="shrink-0 text-sm text-muted-foreground">
                {progress.finished} of {progress.total} steps
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Open each screen, try the step, then come back and press{" "}
              <span className="font-medium text-foreground">I&apos;ve done this</span>. Many
              steps tick themselves once the ERP sees you have done the work. Your
              progress is saved, so you can stop and continue later.
            </p>
          </header>

          {progress.current === undefined ? (
            <div className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 px-4 py-3">
              <IconCircleCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  You have finished this training
                </p>
                <p className="text-sm text-muted-foreground">
                  Well done. You can come back to any step whenever you need a reminder.
                </p>
              </div>
            </div>
          ) : null}

          <ol className="space-y-3">
            {progress.steps.map((step, index) => (
              <StepItem
                key={step.key}
                step={step}
                number={index + 1}
                entry={entries.get(step.key)}
                current={progress.current?.key === step.key}
              />
            ))}
          </ol>

          <QuizPanel trackKey={progress.track.key} primary={progress.current === undefined} />
        </>
      ) : null}
    </div>
  );
}
