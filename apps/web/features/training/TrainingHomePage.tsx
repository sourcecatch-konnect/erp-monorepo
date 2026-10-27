"use client";

import Link from "next/link";
import {
  IconArrowRight,
  IconBuildingStore,
  IconCircleCheck,
  IconPlayerPlayFilled,
  IconRoute,
  IconUserCircle,
  type Icon,
} from "@tabler/icons-react";
import { TRAINING_STAGES, type TrainingMe } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { cn } from "@skerp/ui/lib/util";
import { TRACK_ICONS } from "./content/track-icons";
import { ProgressBar } from "./components/ProgressBar";
import { ProgressRing } from "./components/ProgressRing";
import { TrainingNav } from "./components/TrainingNav";
import { useCompleteOnVisit, useTrainingMe } from "./hooks/useTraining";
import {
  progressMap,
  trackProgress,
  type TrackProgress,
} from "./lib/catalog-lookup";

function YourRole({ me }: { me: TrainingMe }) {
  const branches =
    me.branchScope === "ALL"
      ? "All branches"
      : me.branches.map((branch) => branch.name).join(", ") || "None assigned";

  return (
    <section className="rounded-md border border-border bg-card p-5">
      <div className="flex flex-wrap items-start gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <IconUserCircle className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Your role</p>
          <p className="text-lg font-semibold text-foreground">
            {me.role.name}
          </p>
          <p className="text-sm text-muted-foreground">
            {me.profile?.summary ??
              "Below is the training for your role, the steps of the business you do, and who picks up the work after you."}
          </p>
        </div>
        <div className="flex items-start gap-2">
          <IconBuildingStore
            className="mt-0.5 size-4 text-muted-foreground"
            aria-hidden
          />
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Branches you work in
            </p>
            <p className="text-sm text-foreground">{branches}</p>
          </div>
        </div>
      </div>

      {me.profile && me.profile.responsibilities.length > 0 ? (
        <ul className="mt-4 list-disc space-y-1 border-t border-border pl-5 pt-4 text-sm text-foreground">
          {me.profile.responsibilities.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

const trackAction = (progress: TrackProgress) =>
  progress.current === undefined
    ? "Review"
    : progress.finished === 0
      ? "Start"
      : "Continue";

/** A required track: a wide row, because it is what the user has to do. */
function TrackRow({
  progress,
  primary,
  quizPassed,
}: {
  progress: TrackProgress;
  primary: boolean;
  quizPassed: boolean;
}) {
  const complete = progress.current === undefined;
  const RowIcon: Icon = TRACK_ICONS[progress.track.key];

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-md border border-border bg-card p-4">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-md",
          complete
            ? "bg-success/15 text-success"
            : "bg-primary/10 text-primary",
        )}
      >
        <RowIcon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-foreground">
            {progress.track.title}
          </p>
          {complete ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-success/35 bg-success/12 px-2 py-0.5 text-xs font-semibold text-success">
              <IconCircleCheck className="size-3.5" aria-hidden />
              Completed
            </span>
          ) : (
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              Required
            </span>
          )}
          {quizPassed ? (
            <span className="rounded-full border border-success/35 bg-success/12 px-2 py-0.5 text-xs font-semibold text-success">
              Quiz passed
            </span>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {progress.track.description}
        </p>
        <div className="flex max-w-md items-center gap-3">
          <ProgressBar
            percent={progress.percent}
            label={`${progress.track.title} progress`}
          />
          <span className="shrink-0 text-xs text-muted-foreground">
            {progress.finished} of {progress.total} lessons
          </span>
        </div>
      </div>
      <Button asChild variant={primary ? "default" : "outline"}>
        <Link href={`/training/${progress.track.key}`}>
          {trackAction(progress)}
        </Link>
      </Button>
    </div>
  );
}

/** An optional track: a quieter card in a grid, so the shape says "extra". */
function TrackCard({ progress }: { progress: TrackProgress }) {
  const CardIcon: Icon = TRACK_ICONS[progress.track.key];
  const complete = progress.current === undefined;

  return (
    <div className="flex flex-col gap-2.5 rounded-md border border-border bg-card p-4 transition-colors duration-150 hover:border-primary/40">
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-md",
            complete
              ? "bg-success/15 text-success"
              : "bg-primary/10 text-primary",
          )}
        >
          <CardIcon className="size-[18px]" aria-hidden />
        </span>
        <ProgressRing
          percent={progress.percent}
          label={`${progress.track.title} progress`}
          size={40}
        />
      </div>
      <p className="text-sm font-semibold text-foreground">
        {progress.track.title}
      </p>
      <p className="flex-1 text-xs text-muted-foreground">
        {progress.track.description}
      </p>
      <p className="text-xs text-muted-foreground">
        {progress.total} {progress.total === 1 ? "lesson" : "lessons"}
      </p>
      <Button asChild variant="outline" className="self-start">
        <Link href={`/training/${progress.track.key}`}>
          {trackAction(progress)}
        </Link>
      </Button>
    </div>
  );
}

/** One obvious next action, instead of making the user choose between cards. */
function ResumeCard({ progress }: { progress: TrackProgress }) {
  const step = progress.current;
  if (!step) return null;

  return (
    <Link
      href={`/training/${progress.track.key}`}
      className="flex flex-wrap items-center gap-4 rounded-md border border-primary/30 bg-primary/5 p-4 transition-colors duration-150 hover:bg-primary/10"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <IconPlayerPlayFilled className="size-[18px]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="block text-xs font-semibold uppercase tracking-tight text-primary">
          Pick up where you left off
        </span>
        <span className="block text-base font-semibold text-foreground">
          {step.title}
        </span>
        <span className="block text-xs text-muted-foreground">
          {progress.track.title} · lesson {progress.finished + 1} of{" "}
          {progress.total}
        </span>
        <ProgressBar
          percent={progress.percent}
          label={`${progress.track.title} progress`}
          className="max-w-xs"
        />
      </span>
      <span className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">
        Continue
        <IconArrowRight className="size-4" aria-hidden />
      </span>
    </Link>
  );
}

function YourTraining({ me }: { me: TrainingMe }) {
  const entries = progressMap(me);
  const all = me.tracks
    .map((view) => trackProgress(view, entries))
    .filter((item): item is TrackProgress => item !== null);
  const required = all.filter((item) => item.view.assignment === "required");
  const optional = all.filter((item) => item.view.assignment === "optional");
  const firstOpen = required.find((item) => item.current !== undefined);
  const passed = new Set(
    me.certifications
      .filter((cert) => cert.passed)
      .map((cert) => cert.trackKey),
  );

  return (
    <>
      {firstOpen ? <ResumeCard progress={firstOpen} /> : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">
            Training for your role
          </h2>
          <span className="text-xs text-muted-foreground">
            {required.length} {required.length === 1 ? "track" : "tracks"} ·
            required
          </span>
          <p className="w-full text-sm text-muted-foreground">
            Everyone in your role does these. Your progress is saved, so you can
            stop and continue any time.
          </p>
        </div>
        {required.map((item) => (
          <TrackRow
            key={item.track.key}
            progress={item}
            primary={item.track.key === firstOpen?.track.key}
            quizPassed={passed.has(item.track.key)}
          />
        ))}
      </section>

      {optional.length > 0 ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">
              More training you can take
            </h2>
            <span className="text-xs text-muted-foreground">
              {optional.length} {optional.length === 1 ? "track" : "tracks"}
            </span>
            <p className="w-full text-sm text-muted-foreground">
              Not required for your role, but useful if you help out in these
              areas.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {optional.map((item) => (
              <TrackCard key={item.track.key} progress={item} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

/**
 * Where your work sits in the business is a whole screen of its own
 * ("How the business works", which highlights your own steps), so this page
 * only points at it.
 */
function WhereYouFit({ me }: { me: TrainingMe }) {
  const mine = me.stages.filter((stage) => stage.owned).length;

  return (
    <Link
      href="/training/process-map"
      className="flex flex-wrap items-center gap-4 rounded-md border border-border bg-card p-4 transition-colors duration-150 hover:border-primary/40"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <IconRoute className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">
          See where your work fits in the business
        </span>
        <span className="block text-sm text-muted-foreground">
          {mine === 0
            ? "Follow an order from booking to payment and see who does each step."
            : `${mine} of the ${TRAINING_STAGES.length} business steps are yours. See what comes before you and who picks up after you.`}
        </span>
      </span>
      <IconArrowRight
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden
      />
    </Link>
  );
}

/** A2 — My Role: who you are in the ERP, your training, and your steps. */
export function TrainingHomePage() {
  const { data, isLoading, isError, error } = useTrainingMe();
  useCompleteOnVisit("/training");

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          My role & training
        </h1>
        <p className="text-sm text-muted-foreground">
          Learn what your role does in the ERP and where your work fits in the
          business.
        </p>
      </header>

      <TrainingNav />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : null}

      {isError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          We couldn&apos;t load your training: {error.message}
        </p>
      ) : null}

      {data ? (
        <>
          <YourRole me={data} />
          <YourTraining me={data} />
          <WhereYouFit me={data} />
        </>
      ) : null}
    </div>
  );
}
