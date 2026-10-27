"use client";

import Link from "next/link";
import {
  IconArrowRight,
  IconBook2,
  IconCertificate,
  IconCircleCheck,
  IconLifebuoy,
  IconListCheck,
  IconPlayerPlayFilled,
  IconRoute,
  IconSchool,
  IconStar,
  IconTargetArrow,
  type Icon,
} from "@tabler/icons-react";
import { TRAINING_STAGES, type TrainingMe } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { cn } from "@skerp/ui/lib/util";
import { GLOSSARY } from "./content/glossary";
import { TRACK_ICONS, TRACK_TONES } from "./content/track-icons";
import { FirstWeekCard } from "./components/FirstWeekCard";
import { ProgressBar } from "./components/ProgressBar";
import { ProgressRing } from "./components/ProgressRing";
import { StatTile } from "./components/StatTile";
import { TrainingHero } from "./components/TrainingHero";
import { TrainingNav } from "./components/TrainingNav";
import { useCompleteOnVisit, useTrainingMe } from "./hooks/useTraining";
import {
  progressMap,
  trackProgress,
  type TrackProgress,
} from "./lib/catalog-lookup";

/** The soft icon chip for each learning accent. */
const TONE_BADGE: Record<1 | 2 | 3 | 4 | 5 | 6, string> = {
  1: "bg-learn-1-soft text-learn-1",
  2: "bg-learn-2-soft text-learn-2",
  3: "bg-learn-3-soft text-learn-3",
  4: "bg-learn-4-soft text-learn-4",
  5: "bg-learn-5-soft text-learn-5",
  6: "bg-learn-6-soft text-learn-6",
};

const trackAction = (progress: TrackProgress) =>
  progress.current === undefined
    ? "Review"
    : progress.finished === 0
      ? "Start"
      : "Continue";

/** Everything the page counts, worked out once from /training/me. */
function summarise(me: TrainingMe) {
  const entries = progressMap(me);
  const all = me.tracks
    .map((view) => trackProgress(view, entries))
    .filter((item): item is TrackProgress => item !== null);
  const required = all.filter((item) => item.view.assignment === "required");
  const optional = all.filter((item) => item.view.assignment === "optional");

  const sum = (list: TrackProgress[], pick: (item: TrackProgress) => number) =>
    list.reduce((total, item) => total + pick(item), 0);

  const requiredDone = sum(required, (item) => item.finished);
  const requiredTotal = sum(required, (item) => item.total);
  const tracksComplete = required.filter(
    (item) => item.current === undefined,
  ).length;

  return {
    all,
    required,
    optional,
    firstOpen: required.find((item) => item.current !== undefined),
    passed: new Set(
      me.certifications
        .filter((cert) => cert.passed)
        .map((cert) => cert.trackKey),
    ),
    lessonsDone: sum(all, (item) => item.finished),
    lessonsTotal: sum(all, (item) => item.total),
    requiredDone,
    requiredTotal,
    tracksComplete,
    ownedStages: me.stages.filter((stage) => stage.owned).length,
    readiness:
      requiredTotal === 0
        ? 100
        : Math.round((requiredDone / requiredTotal) * 100),
    completed:
      required.length === 0
        ? 100
        : Math.round((tracksComplete / required.length) * 100),
  };
}

type Summary = ReturnType<typeof summarise>;

/** The row of numbers under the hero — all counted from real progress. */
function TrainingStats({ summary }: { summary: Summary }) {
  const left = summary.lessonsTotal - summary.lessonsDone;

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <StatTile
        icon={IconSchool}
        tone={1}
        label="Lessons"
        value={`${summary.lessonsDone}/${summary.lessonsTotal}`}
        hint={left === 0 ? "All done" : `${left} left`}
      />
      <StatTile
        icon={IconListCheck}
        tone={2}
        label="Required tracks"
        value={`${summary.tracksComplete}/${summary.required.length}`}
        hint="Done for your role"
      />
      <StatTile
        icon={IconCertificate}
        tone={3}
        label="Quizzes passed"
        value={`${summary.passed.size}/${summary.all.length}`}
        hint="One per track"
      />
      <StatTile
        icon={IconStar}
        tone={4}
        label="Extra tracks"
        value={`${summary.optional.length}`}
        hint="Open to you"
      />
      <StatTile
        icon={IconRoute}
        tone={5}
        label="Your business steps"
        value={`${summary.ownedStages}/${TRAINING_STAGES.length}`}
        hint="See the whole flow"
        href="/training/process-map"
      />
      <StatTile
        icon={IconBook2}
        tone={6}
        label="Glossary"
        value={`${GLOSSARY.length}`}
        hint="Words the ERP uses"
        href="/training/glossary"
      />
    </section>
  );
}

/** One obvious next action, instead of making the user choose between cards. */
function ResumeCard({ progress }: { progress: TrackProgress }) {
  const step = progress.current;
  if (!step) return null;

  return (
    <Link
      href={`/training/${progress.track.key}`}
      className="flex flex-wrap items-center gap-4 rounded-lg border border-primary/30 bg-primary/5 p-4 transition-colors duration-150 hover:bg-primary/10"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <IconPlayerPlayFilled className="size-[18px]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="block text-xs font-semibold uppercase tracking-tight text-primary">
          Recommended next
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
      <span className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">
        {progress.finished === 0 ? "Start" : "Continue"}
        <IconArrowRight className="size-4" aria-hidden />
      </span>
    </Link>
  );
}

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
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors duration-150 hover:border-primary/40">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          complete
            ? "bg-success/15 text-success"
            : TONE_BADGE[TRACK_TONES[progress.track.key]],
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
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
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
    <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-card p-4 transition-colors duration-150 hover:border-primary/40">
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            complete
              ? "bg-success/15 text-success"
              : TONE_BADGE[TRACK_TONES[progress.track.key]],
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

/** What this role is responsible for, in the role's own words. */
function RoleDuties({ me }: { me: TrainingMe }) {
  if (!me.profile || me.profile.responsibilities.length === 0) return null;

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-base font-semibold text-foreground">
        What {me.role.name} does
      </h2>
      <ul className="mt-3 space-y-2">
        {me.profile.responsibilities.map((item) => (
          <li
            key={item}
            className="flex items-start gap-2 text-sm text-foreground"
          >
            <IconCircleCheck
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Two small cards that keep the right rail from ending on a dead edge. */
function SideHelp({ summary }: { summary: Summary }) {
  const allDone = summary.firstOpen === undefined;
  const left = summary.requiredTotal - summary.requiredDone;

  return (
    <>
      <section className="rounded-lg border border-success/30 bg-success/5 p-5">
        <span className="flex size-10 items-center justify-center rounded-lg bg-success/15 text-success">
          <IconTargetArrow className="size-5" aria-hidden />
        </span>
        <h2 className="mt-3 text-base font-semibold text-foreground">
          {allDone ? "You are up to date" : "Keep going"}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {allDone
            ? "Everything your role needs is done. Take an optional track when you have the time."
            : `${left} ${left === 1 ? "lesson" : "lessons"} left in the training your role needs.`}
        </p>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <IconLifebuoy className="size-5" aria-hidden />
        </span>
        <h2 className="mt-3 text-base font-semibold text-foreground">
          Need help?
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Look up any word the ERP uses, or ask the person who does the step
          before yours.
        </p>
        <Button asChild variant="outline" className="mt-3.5">
          <Link href="/training/glossary">
            <IconBook2 className="size-4" aria-hidden />
            Open the glossary
          </Link>
        </Button>
      </section>
    </>
  );
}

/**
 * Where your work sits in the business is a whole screen of its own
 * ("How the business works", which highlights your own steps), so this page
 * only points at it.
 */
function WhereYouFit({ summary }: { summary: Summary }) {
  return (
    <Link
      href="/training/process-map"
      className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors duration-150 hover:border-primary/40"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <IconRoute className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">
          See where your work fits in the business
        </span>
        <span className="block text-sm text-muted-foreground">
          {summary.ownedStages === 0
            ? "Follow an order from booking to payment and see who does each step."
            : `${summary.ownedStages} of the ${TRAINING_STAGES.length} business steps are yours. See what comes before you and who picks up after you.`}
        </span>
      </span>
      <IconArrowRight
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden
      />
    </Link>
  );
}
function TrainingBody({ me }: { me: TrainingMe }) {
  const summary = summarise(me);

  return (
    <>
      <TrainingHero
        me={me}
        readiness={summary.readiness}
        completed={summary.completed}
      />

      <TrainingStats summary={summary} />

      {summary.firstOpen ? <ResumeCard progress={summary.firstOpen} /> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
        <section className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">
              Training for your role
            </h2>

            <span className="text-xs text-muted-foreground">
              {summary.required.length}{" "}
              {summary.required.length === 1 ? "track" : "tracks"} · required
            </span>

            <p className="w-full text-sm text-muted-foreground">
              Everyone in your role does these. Your progress is saved, so you
              can stop and continue any time.
            </p>
          </div>

          {summary.required.map((item) => (
            <TrackRow
              key={item.track.key}
              progress={item}
              primary={item.track.key === summary.firstOpen?.track.key}
              quizPassed={summary.passed.has(item.track.key)}
            />
          ))}

          {summary.optional.length > 0 ? (
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold text-foreground">
                  More training you can take
                </h2>

                <span className="text-xs text-muted-foreground">
                  {summary.optional.length}{" "}
                  {summary.optional.length === 1 ? "track" : "tracks"}
                </span>

                <p className="w-full text-sm text-muted-foreground">
                  Not required for your role, but useful if you help out in
                  these areas.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {summary.optional.map((item) => (
                  <TrackCard key={item.track.key} progress={item} />
                ))}
              </div>
            </div>
          ) : null}

          <WhereYouFit summary={summary} />
        </section>

        <div className="min-w-0 space-y-6">
          <FirstWeekCard me={me} />
          <SideHelp summary={summary} />
          <RoleDuties me={me} />
        </div>
      </div>
    </>
  );
}

/** A2 — My Role: who you are in the ERP, your training, and your steps. */
export function TrainingHomePage() {
  const { data, isLoading, isError, error } = useTrainingMe();
  useCompleteOnVisit("/training");

  return (
    <div className="w-full space-y-4">
      <header className="space-y-0.5">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          My role &amp; training
        </h1>
        <p className="text-sm text-muted-foreground">
          Learn what your role does in the ERP and where your work fits in the
          business.
        </p>
      </header>

      <TrainingNav />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : null}

      {isError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          We couldn&apos;t load your training: {error.message}
        </p>
      ) : null}

      {data ? <TrainingBody me={data} /> : null}
    </div>
  );
}
