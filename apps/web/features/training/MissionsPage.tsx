"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  IconCircleCheck,
  IconCircleDashed,
  IconRefresh,
} from "@tabler/icons-react";
import {
  TRAINING_MISSIONS,
  TRAINING_TRACKS,
  missionStepKey,
  type TrainingMission,
  type TrainingMissionView,
  type TrainingVerifierKey,
} from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { cn } from "@skerp/ui/lib/util";
import { TrainingNav } from "./components/TrainingNav";
import { VERIFIER_LABELS } from "./content/verifier-labels";
import { useStepProgress, useTrainingMe } from "./hooks/useTraining";
import { trainingKeys } from "./training.keys";
import { missionsApi } from "./training.service";

const TRACK_TITLE = new Map(
  TRAINING_TRACKS.map((track) => [track.key, track.title]),
);
const MISSION_BY_KEY = new Map(
  TRAINING_MISSIONS.map((mission) => [mission.key, mission]),
);

/** What the seed creates — kept in step with apps/server/prisma/seed-training.ts. */
const DEMO_DATA: [string, string][] = [
  ["Branches", "Demo Pune (head office), Demo Jalgaon, Demo Guwahati"],
  ["Customers", "Demo Appliances Ltd (Pune), Demo Foods Pvt Ltd (Jalgaon)"],
  ["Rate", "Demo Appliances, Pune → Guwahati, 32 ft HQ: ₹1,40,000"],
  ["Vehicles", "MH19TR0001 (own), MH12TR0002 (market)"],
  ["Drivers", "Demo Driver Ramesh, Demo Driver Suresh"],
  [
    "Rail",
    "Demo Pune Rail Head → Demo Guwahati Rail Head, Demo BCN Wagon: ₹1,85,000",
  ],
  ["Workshop", "Demo Brake Pads from Demo Auto Spares"],
  ["Accounts", "Demo Bank Account, Demo Cash"],
  [
    "Trainee logins",
    "trainee.ops, trainee.manager, trainee.accounts, trainee.auditor, trainee.rail, trainee.admin (all @training.local; ask your trainer for the password)",
  ],
];

function MissionCard({
  mission,
  view,
  mine,
}: {
  mission: TrainingMission;
  view: TrainingMissionView;
  mine: boolean;
}) {
  const queryClient = useQueryClient();
  const progress = useStepProgress();
  const selfMarked = mission.verifiers.length === 0;
  const mark = (status: "DONE" | null) =>
    progress.mutate(
      { stepKey: missionStepKey(mission.key), status },
      {
        onSettled: () =>
          void queryClient.invalidateQueries({
            queryKey: trainingKeys.missions,
          }),
      },
    );

  return (
    <article
      className={cn(
        "space-y-3 rounded-lg border bg-card p-5",
        view.done ? "border-primary/40" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            {TRACK_TITLE.get(mission.trackKey)}
            {mine ? " · your training" : ""}
          </p>
          <h3 className="text-base font-semibold text-foreground">
            {mission.title}
          </h3>
        </div>
        {view.done ? (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
            <IconCircleCheck className="size-4" aria-hidden />
            Done
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Not done yet</span>
        )}
      </div>

      <p className="border-l-2 border-primary/40 pl-3 text-sm italic text-foreground">
        {mission.story}
      </p>

      {mission.before ? (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            Before you start:{" "}
          </span>
          {mission.before}
        </p>
      ) : null}

      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-foreground">
        {mission.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      {selfMarked ? (
        <div>
          {view.done ? (
            <Button
              variant="ghost"
              disabled={progress.isPending}
              onClick={() => mark(null)}
            >
              Undo
            </Button>
          ) : (
            <Button
              variant="outline"
              disabled={progress.isPending}
              onClick={() => mark("DONE")}
            >
              I&apos;ve done this mission
            </Button>
          )}
        </div>
      ) : (
        <ul className="space-y-1 rounded-lg bg-muted/40 p-3">
          {view.checks.map((check) => (
            <li
              key={check.verifier}
              className="flex items-center gap-2 text-sm"
            >
              {check.done ? (
                <IconCircleCheck
                  className="size-4 shrink-0 text-primary"
                  aria-label="Done"
                />
              ) : (
                <IconCircleDashed
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-label="Not yet"
                />
              )}
              <span
                className={
                  check.done ? "text-foreground" : "text-muted-foreground"
                }
              >
                {VERIFIER_LABELS[check.verifier as TrainingVerifierKey] ??
                  check.verifier}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/** A9 — practice missions on the training copy's demo data. */
export function MissionsPage() {
  const { data: me } = useTrainingMe();
  const missions = useQuery({
    queryKey: trainingKeys.missions,
    queryFn: missionsApi.list,
  });
  const myTracks = new Set(
    (me?.tracks ?? [])
      .filter((t) => t.assignment === "required")
      .map((t) => t.key),
  );
  const views = [...(missions.data ?? [])].sort((a, b) => {
    const aMine = myTracks.has(MISSION_BY_KEY.get(a.key)?.trackKey ?? "basics")
      ? 0
      : 1;
    const bMine = myTracks.has(MISSION_BY_KEY.get(b.key)?.trackKey ?? "basics")
      ? 0
      : 1;
    return aMine - bMine;
  });

  return (
    <div className="max-w-4xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Practice missions
        </h1>
        <p className="text-sm text-muted-foreground">
          Real-life jobs to do from start to finish on made-up data. Nothing
          here is real, so you can&apos;t break anything. The data is reset
          every night.
        </p>
      </header>

      <TrainingNav />

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">
          The demo data you can use
        </h2>
        <dl className="mt-3 grid gap-2 text-sm">
          {DEMO_DATA.map(([label, value]) => (
            <div
              key={label}
              className="grid gap-0.5 sm:grid-cols-[150px_1fr] sm:gap-3"
            >
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Missions with a checklist tick themselves when the ERP sees the work.
        </p>
        <Button
          variant="outline"
          disabled={missions.isFetching}
          onClick={() => void missions.refetch()}
        >
          <IconRefresh className="size-4" aria-hidden />
          {missions.isFetching ? "Checking…" : "Check my missions"}
        </Button>
      </div>

      {missions.isError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Practice missions are only available on the training copy of the ERP.
        </p>
      ) : null}

      {missions.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <div className="space-y-3">
          {views.map((view) => {
            const mission = MISSION_BY_KEY.get(view.key);
            return mission ? (
              <MissionCard
                key={view.key}
                mission={mission}
                view={view}
                mine={myTracks.has(mission.trackKey)}
              />
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}
