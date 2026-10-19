"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  IconArrowRight,
  IconBuildingStore,
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
import { trainingKeys } from "./training.keys";
import { trainingApi } from "./training.service";

const STAGE_BY_KEY = new Map<TrainingStageKey, TrainingStage>(
  TRAINING_STAGES.map((stage) => [stage.key, stage]),
);

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
          <p className="text-xs font-medium text-muted-foreground">
            You are signed in as
          </p>
          <p className="text-lg font-semibold text-foreground">{me.role.name}</p>
          <p className="text-sm text-muted-foreground">
            {me.profile?.summary ??
              "Below are the steps of the business your role takes part in, and who picks up the work after you."}
          </p>
        </div>
        <div className="flex items-start gap-2">
          <IconBuildingStore className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
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

function NextSteps({
  stage,
  views,
}: {
  stage: TrainingStage;
  views: Map<TrainingStageKey, TrainingStageView>;
}) {
  if (stage.next.length === 0) return null;
  return (
    <ul className="space-y-1">
      {stage.next.map((key) => {
        const next = STAGE_BY_KEY.get(key);
        const view = views.get(key);
        if (!next || !view) return null;
        const who = view.owned
          ? "you do this too"
          : view.owners.length > 0
            ? `done by ${view.owners.join(", ")}`
            : "not assigned to a role yet";
        return (
          <li key={key} className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <IconArrowRight className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              Next: <span className="font-medium text-foreground">{next.title}</span>{" "}
              ({who})
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function YourWork({ me }: { me: TrainingMe }) {
  const views = new Map(me.stages.map((view) => [view.key, view]));
  const lanes = TRAINING_LANES.map((lane) => ({
    lane,
    stages: TRAINING_STAGES.filter(
      (stage) => stage.lane === lane.key && views.get(stage.key)?.owned,
    ),
  })).filter((group) => group.stages.length > 0);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-foreground">Your part of the work</h2>
        <p className="text-sm text-muted-foreground">
          These are the business steps your role does. Under each step you can
          see what happens next and who does it.
        </p>
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
              {stages.map((stage) => (
                <li key={stage.key} className="flex flex-wrap items-start gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-sm font-semibold text-foreground">{stage.title}</p>
                    <p className="text-sm text-muted-foreground">{stage.summary}</p>
                    <NextSteps stage={stage} views={views} />
                  </div>
                  {views.get(stage.key)?.canOpen ? (
                    <Button asChild variant="outline">
                      <Link href={stage.href}>Open screen</Link>
                    </Button>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        ))
      )}
    </section>
  );
}

/** Training home (Phase 0): who you are in the ERP and which steps you own. */
export function TrainingHomePage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: trainingKeys.me,
    queryFn: trainingApi.me,
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Training</h1>
        <p className="text-sm text-muted-foreground">
          Learn what your role does in the ERP and where your work fits in the
          business.
        </p>
      </header>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
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
          <YourWork me={data} />
        </>
      ) : null}
    </div>
  );
}
