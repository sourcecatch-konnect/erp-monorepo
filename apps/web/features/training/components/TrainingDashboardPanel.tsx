"use client";

import { Fragment } from "react";
import Link from "next/link";
import {
  IconArrowRight,
  IconCircleCheck,
  IconSchool,
} from "@tabler/icons-react";
import type { TrainingMe } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { cn } from "@skerp/ui/lib/util";
import { MAIN_FLOW } from "../content/process-map";
import { useTrainingMe } from "../hooks/useTraining";
import {
  progressMap,
  trackProgress,
  type TrackProgress,
} from "../lib/catalog-lookup";
import { ProgressBar } from "./ProgressBar";

function ContinueTraining({ me }: { me: TrainingMe }) {
  const entries = progressMap(me);
  const next = me.tracks
    .filter((view) => view.assignment === "required")
    .map((view) => trackProgress(view, entries))
    .find(
      (item): item is TrackProgress =>
        item !== null && item.current !== undefined,
    );

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <IconSchool className="size-5 text-primary" aria-hidden />
        <h2 className="text-base font-semibold text-foreground">
          Your training
        </h2>
      </div>
      {next ? (
        <>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {next.track.title}
            </p>
            <p className="text-sm text-muted-foreground">
              Next step: {next.current?.title}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ProgressBar
              percent={next.percent}
              label={`${next.track.title} progress`}
            />
            <span className="shrink-0 text-xs text-muted-foreground">
              {next.finished} of {next.total} steps
            </span>
          </div>
          <div>
            <Button asChild>
              <Link href={`/training/${next.track.key}`}>
                Continue training
              </Link>
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="flex items-center gap-2 text-sm text-foreground">
            <IconCircleCheck className="size-4 text-primary" aria-hidden />
            You have finished the training for your role.
          </p>
          <div>
            <Button asChild variant="outline">
              <Link href="/training">See my role</Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function MiniMap({ me }: { me: TrainingMe }) {
  const owned = new Set(me.stages.filter((s) => s.owned).map((s) => s.key));
  const sections = MAIN_FLOW.map((section) => ({
    section,
    yours: section.paths.some((path) =>
      path.stages.some((key) => owned.has(key)),
    ),
  }));
  const yoursCount = sections.filter((item) => item.yours).length;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          How the business works
        </h2>
        <p className="text-sm text-muted-foreground">
          {yoursCount > 0
            ? `You take part in ${yoursCount} of the ${sections.length} parts, marked in blue.`
            : `The ${sections.length} parts every order goes through.`}
        </p>
      </div>
      <ol className="flex flex-wrap items-center gap-1.5">
        {sections.map(({ section, yours }, index) => (
          <Fragment key={section.key}>
            {index > 0 ? (
              <li aria-hidden className="text-muted-foreground">
                <IconArrowRight className="size-3.5" />
              </li>
            ) : null}
            <li
              className={cn(
                "rounded-lg border px-2 py-1 text-sm",
                yours
                  ? "border-primary bg-primary/5 font-medium text-primary"
                  : "border-border bg-card text-foreground",
              )}
            >
              {section.title}
              {yours ? <span className="sr-only"> (you take part)</span> : null}
            </li>
          </Fragment>
        ))}
      </ol>
      <div>
        <Button asChild variant="outline">
          <Link href="/training/process-map">Open the full map</Link>
        </Button>
      </div>
    </div>
  );
}

/** Dashboard cards: continue your training + the business at a glance. */
export function TrainingDashboardPanel() {
  const { data: me, isLoading } = useTrainingMe();

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-44 w-full" />
      </div>
    );
  }
  if (!me) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ContinueTraining me={me} />
      <MiniMap me={me} />
    </div>
  );
}
