"use client";

import { useState } from "react";
import Link from "next/link";
import {
  IconArrowLeft,
  IconArrowRight,
  IconBuildingStore,
  IconCircleCheck,
  IconRoute,
  IconUserCircle,
} from "@tabler/icons-react";
import {
  TRAINING_LANES,
  TRAINING_STAGES,
  type TrainingMe,
  type TrainingStage,
  type TrainingStageKey,
  type TrainingStageView,
} from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { ProgressBar } from "./components/ProgressBar";
import { StageSheet } from "./components/StageSheet";
import { TrainingNav } from "./components/TrainingNav";
import { useCompleteOnVisit, useTrainingMe } from "./hooks/useTraining";
import {
  STAGE_BY_KEY,
  previousStages,
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
          <p className="text-lg font-semibold text-foreground">{me.role.name}</p>
          <p className="text-sm text-muted-foreground">
            {me.profile?.summary ??
              "Below is the training for your role, the steps of the business you do, and who picks up the work after you."}
          </p>
        </div>
        <div className="flex items-start gap-2">
          <IconBuildingStore className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
          <div>
            <p className="text-xs font-medium text-muted-foreground">Branches you work in</p>
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

function TrackCard({ progress, primary }: { progress: TrackProgress; primary: boolean }) {
  const complete = progress.current === undefined;
  const action = complete ? "Review" : progress.finished === 0 ? "Start" : "Continue";
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-md border border-border bg-card p-4">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{progress.track.title}</p>
          {complete ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
              <IconCircleCheck className="size-3.5" aria-hidden />
              Completed
            </span>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">{progress.track.description}</p>
        <div className="flex max-w-md items-center gap-3">
          <ProgressBar percent={progress.percent} label={`${progress.track.title} progress`} />
          <span className="shrink-0 text-xs text-muted-foreground">
            {progress.finished} of {progress.total} steps
          </span>
        </div>
      </div>
      <Button asChild variant={primary ? "default" : "outline"}>
        <Link href={`/training/${progress.track.key}`}>{action}</Link>
      </Button>
    </div>
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

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-foreground">Your training</h2>
        <p className="text-sm text-muted-foreground">
          Short, step-by-step training for your role. Your progress is saved, so
          you can stop and continue any time.
        </p>
      </div>
      {required.map((item) => (
        <TrackCard
          key={item.track.key}
          progress={item}
          primary={item.track.key === firstOpen?.track.key}
        />
      ))}
      {optional.length > 0 ? (
        <details className="rounded-md border border-border bg-card px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            More training you can take ({optional.length})
          </summary>
          <p className="mt-1 text-xs text-muted-foreground">
            Not required for your role, but useful if you help out in these areas.
          </p>
          <div className="mt-3 space-y-3">
            {optional.map((item) => (
              <TrackCard key={item.track.key} progress={item} primary={false} />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function Neighbours({
  stage,
  views,
}: {
  stage: TrainingStage;
  views: Map<TrainingStageKey, TrainingStageView>;
}) {
  const who = (key: TrainingStageKey) => {
    const view = views.get(key);
    if (!view) return "";
    if (view.owned) return "you do this too";
    return view.owners.length > 0
      ? `done by ${view.owners.join(", ")}`
      : "not assigned to a role yet";
  };
  const before = previousStages(stage.key);
  const after = stage.next
    .map((key) => STAGE_BY_KEY.get(key))
    .filter((next): next is TrainingStage => next !== undefined);
  if (before.length === 0 && after.length === 0) return null;

  return (
    <ul className="space-y-1">
      {before.map((prev) => (
        <li key={`b-${prev.key}`} className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <IconArrowLeft className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            Before you: <span className="font-medium text-foreground">{prev.title}</span>{" "}
            ({who(prev.key)})
          </span>
        </li>
      ))}
      {after.map((next) => (
        <li key={`a-${next.key}`} className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <IconArrowRight className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            After you: <span className="font-medium text-foreground">{next.title}</span>{" "}
            ({who(next.key)})
          </span>
        </li>
      ))}
    </ul>
  );
}

function YourWork({
  me,
  onLearnMore,
}: {
  me: TrainingMe;
  onLearnMore: (key: TrainingStageKey) => void;
}) {
  const views = new Map(me.stages.map((view) => [view.key, view]));
  const lanes = TRAINING_LANES.map((lane) => ({
    lane,
    stages: TRAINING_STAGES.filter(
      (stage) => stage.lane === lane.key && views.get(stage.key)?.owned,
    ),
  })).filter((group) => group.stages.length > 0);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Your part of the work</h2>
          <p className="text-sm text-muted-foreground">
            The business steps your role does, what you can do at each one, and
            who works before and after you.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/training/process-map">
            <IconRoute className="size-4" aria-hidden />
            See the whole business
          </Link>
        </Button>
      </div>

      {lanes.length === 0 ? (
        <div className="rounded-md border border-border bg-card px-5 py-10 text-center">
          <p className="text-sm font-medium text-foreground">
            Your role doesn&apos;t do any of the main business steps yet
          </p>
          <p className="text-sm text-muted-foreground">
            If this looks wrong, ask your administrator to check your role.
          </p>
        </div>
      ) : (
        lanes.map(({ lane, stages }) => (
          <div key={lane.key} className="rounded-md border border-border bg-card">
            <div className="border-b border-border px-5 py-3">
              <h3 className="text-sm font-semibold text-foreground">{lane.title}</h3>
              <p className="text-xs text-muted-foreground">{lane.description}</p>
            </div>
            <ol className="divide-y divide-border">
              {stages.map((stage) => {
                const view = views.get(stage.key);
                return (
                  <li key={stage.key} className="flex flex-wrap items-start gap-4 px-5 py-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-sm font-semibold text-foreground">{stage.title}</p>
                      <p className="text-sm text-muted-foreground">{stage.summary}</p>
                      {view && view.abilities.length > 0 ? (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">
                            What you can do
                          </p>
                          <ul className="flex flex-wrap gap-1.5">
                            {view.abilities.map((ability) => (
                              <li
                                key={ability}
                                className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-xs text-foreground"
                              >
                                <IconCircleCheck className="size-3.5 text-primary" aria-hidden />
                                {ability}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      <Neighbours stage={stage} views={views} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="ghost" onClick={() => onLearnMore(stage.key)}>
                        Learn more
                      </Button>
                      {view?.canOpen ? (
                        <Button asChild variant="outline">
                          <Link href={stage.href}>Open screen</Link>
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        ))
      )}
    </section>
  );
}

/** A2 — My Role: who you are in the ERP, your training, and your steps. */
export function TrainingHomePage() {
  const { data, isLoading, isError, error } = useTrainingMe();
  useCompleteOnVisit("/training");
  const [openStage, setOpenStage] = useState<TrainingStageKey | null>(null);

  return (
    <div className="max-w-5xl space-y-6">
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
          <YourWork me={data} onLearnMore={setOpenStage} />
          <StageSheet
            stageKey={openStage}
            me={data}
            onOpenStage={setOpenStage}
            onClose={() => setOpenStage(null)}
          />
        </>
      ) : null}
    </div>
  );
}
