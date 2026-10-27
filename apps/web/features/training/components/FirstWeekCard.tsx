"use client";

import Link from "next/link";
import { IconCheck, IconChevronRight, IconCircle } from "@tabler/icons-react";
import {
  TRAINING_TRACKS,
  TRAINING_WELCOME_STEP,
  type TrainingMe,
} from "@skerp/types";
import { cn } from "@skerp/ui/lib/util";
import { ProgressBar } from "./ProgressBar";

/** The "go and look at this" step for a page, if the catalog has one. */
const visitStepFor = (href: string) =>
  TRAINING_TRACKS.flatMap((track) => track.steps).find(
    (step) => step.completesOnVisit && step.href === href,
  )?.key;

type Task = { title: string; href: string; done: boolean };

/**
 * A short list of first things to do, each one ticked from work the user has
 * actually done. Seven tracks is a lot to land on; five small tasks is a
 * first week.
 */
export function FirstWeekCard({ me }: { me: TrainingMe }) {
  const done = new Set(me.progress.map((entry) => entry.stepKey));
  const lessonKeys = new Set(me.tracks.flatMap((track) => track.stepKeys));
  const required = me.tracks.filter((track) => track.assignment === "required");
  const mapStep = visitStepFor("/training/process-map");
  const glossaryStep = visitStepFor("/training/glossary");
  const firstRequired = required[0];

  const tasks: Task[] = [
    {
      title: "Read the welcome",
      href: "/training",
      done: done.has(TRAINING_WELCOME_STEP),
    },
    {
      title: "Finish your first lesson",
      href: firstRequired ? `/training/${firstRequired.key}` : "/training",
      done: me.progress.some(
        (entry) => entry.status === "DONE" && lessonKeys.has(entry.stepKey),
      ),
    },
    {
      title: "See how the business works",
      href: "/training/process-map",
      done: mapStep !== undefined && done.has(mapStep),
    },
    {
      title: "Look a word up in the glossary",
      href: "/training/glossary",
      done: glossaryStep !== undefined && done.has(glossaryStep),
    },
    {
      title: "Pass a quiz",
      href: firstRequired ? `/training/${firstRequired.key}` : "/training",
      done: me.certifications.some((cert) => cert.passed),
    },
  ];

  const finished = tasks.filter((task) => task.done).length;

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">
          Your first week
        </h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {finished} of {tasks.length}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Five small things to do before the training feels familiar.
      </p>
      <ProgressBar
        percent={(finished / tasks.length) * 100}
        label="First week progress"
        className="mt-3"
      />
      <ul className="-mx-2 mt-3">
        {tasks.map((task) => (
          <li key={task.title}>
            <Link
              href={task.href}
              className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors duration-150 hover:bg-muted"
            >
              {task.done ? (
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
                  <IconCheck className="size-3.5" aria-hidden />
                </span>
              ) : (
                <IconCircle
                  className="size-5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              )}
              <span
                className={cn(
                  "min-w-0 flex-1 text-sm",
                  task.done
                    ? "text-muted-foreground line-through"
                    : "text-foreground",
                )}
              >
                {task.title}
              </span>
              <IconChevronRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
