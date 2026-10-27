"use client";

import { Fragment } from "react";
import {
  IconArrowDown,
  IconArrowRight,
  IconCircleCheck,
} from "@tabler/icons-react";
import type { TrainingStageKey } from "@skerp/types";
import { cn } from "@skerp/ui/lib/util";
import { MAIN_FLOW, SIDE_FLOWS, type MapSection } from "../content/process-map";
import { STAGE_BY_KEY } from "../lib/catalog-lookup";

export type Highlight = {
  /** Stages to mark. */
  stages: ReadonlySet<TrainingStageKey>;
  /** Text shown on a marked stage, e.g. "Your step" or "Accounts". */
  label: string;
};

function StageChip({
  stageKey,
  highlight,
  onOpen,
}: {
  stageKey: TrainingStageKey;
  highlight: Highlight | null;
  onOpen: (key: TrainingStageKey) => void;
}) {
  const stage = STAGE_BY_KEY.get(stageKey);
  if (!stage) return null;
  const marked = highlight?.stages.has(stageKey) ?? false;

  return (
    <button
      type="button"
      onClick={() => onOpen(stageKey)}
      className={cn(
        "flex w-full flex-col items-start gap-1 rounded-md border px-3 py-2.5 text-left transition-colors duration-150 hover:bg-muted sm:w-44",
        marked ? "border-primary bg-primary/5" : "border-border bg-card",
      )}
    >
      <span className="text-sm font-medium text-foreground">{stage.title}</span>
      {marked ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
          <IconCircleCheck className="size-3.5" aria-hidden />
          {highlight?.label}
        </span>
      ) : null}
    </button>
  );
}

function PathRow({
  stages,
  highlight,
  onOpen,
}: {
  stages: TrainingStageKey[];
  highlight: Highlight | null;
  onOpen: (key: TrainingStageKey) => void;
}) {
  return (
    <ol className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {stages.map((key, index) => (
        <Fragment key={key}>
          {index > 0 ? (
            <li aria-hidden className="flex justify-center text-muted-foreground">
              <IconArrowDown className="size-4 sm:hidden" />
              <IconArrowRight className="hidden size-4 sm:block" />
            </li>
          ) : null}
          <li className="sm:w-auto">
            <StageChip stageKey={key} highlight={highlight} onOpen={onOpen} />
          </li>
        </Fragment>
      ))}
    </ol>
  );
}

function SectionCard({
  section,
  number,
  highlight,
  onOpen,
}: {
  section: MapSection;
  number?: number;
  highlight: Highlight | null;
  onOpen: (key: TrainingStageKey) => void;
}) {
  const SectionIcon = section.icon;
  const split = section.paths.length > 1;

  return (
    <section className="rounded-md border border-border bg-card p-4">
      <header className="mb-3 flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
          {number ?? <SectionIcon className="size-4" aria-hidden />}
        </span>
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {number !== undefined ? (
              <SectionIcon className="size-4 text-muted-foreground" aria-hidden />
            ) : null}
            {section.title}
          </h3>
          <p className="text-xs text-muted-foreground">{section.description}</p>
        </div>
      </header>

      <div className={cn("grid gap-3", split && "xl:grid-cols-2")}>
        {section.paths.map((path, index) => {
          const PathIcon = path.icon;
          return (
            <div
              key={path.label ?? index}
              className={cn(
                "space-y-2",
                split && "rounded-md border border-dashed border-border p-3",
              )}
            >
              {path.label ? (
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  {PathIcon ? <PathIcon className="size-4" aria-hidden /> : null}
                  {path.label}
                </p>
              ) : null}
              <PathRow stages={path.stages} highlight={highlight} onOpen={onOpen} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** The whole business flow. Click any step to read about it. */
export function ProcessMap({
  highlight,
  onOpen,
}: {
  highlight: Highlight | null;
  onOpen: (key: TrainingStageKey) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        {MAIN_FLOW.map((section, index) => (
          <Fragment key={section.key}>
            {index > 0 ? (
              <div aria-hidden className="flex justify-center py-1.5 text-muted-foreground">
                <IconArrowDown className="size-5" />
              </div>
            ) : null}
            <SectionCard
              section={section}
              number={index + 1}
              highlight={highlight}
              onOpen={onOpen}
            />
          </Fragment>
        ))}
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Alongside the main flow</h2>
          <p className="text-sm text-muted-foreground">
            This work happens every day, but not as a step in an order&apos;s journey.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {SIDE_FLOWS.map((section) => (
            <SectionCard
              key={section.key}
              section={section}
              highlight={highlight}
              onOpen={onOpen}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
