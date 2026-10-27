"use client";

import { Fragment } from "react";
import { IconChevronRight } from "@tabler/icons-react";
import { cn } from "@skerp/ui/lib/util";
import { SECTION_TONES, type MapSection } from "../content/process-map";

type Tone = 1 | 2 | 3 | 4 | 5 | 6;

export const TONE_BADGE: Record<Tone, string> = {
  1: "bg-learn-1-soft text-learn-1",
  2: "bg-learn-2-soft text-learn-2",
  3: "bg-learn-3-soft text-learn-3",
  4: "bg-learn-4-soft text-learn-4",
  5: "bg-learn-5-soft text-learn-5",
  6: "bg-learn-6-soft text-learn-6",
};

export const sectionTone = (key: string): Tone => SECTION_TONES[key] ?? 4;

export const stageCount = (section: MapSection) =>
  section.paths.reduce((total, path) => total + path.stages.length, 0);

/**
 * The parts of the business as one row across the top, in order. This is the
 * whole map now: the detail for the chosen step sits below it instead of in a
 * drawer, so the flow never disappears while you read a step.
 */
export function SectionRail({
  sections,
  activeKey,
  onPick,
}: {
  sections: MapSection[];
  activeKey: string | null;
  onPick: (section: MapSection) => void;
}) {
  return (
    <ol
      aria-label="The parts of the business, in order"
      className="grid gap-2 sm:grid-cols-2 lg:flex lg:items-stretch lg:gap-0"
    >
      {sections.map((section, index) => {
        const tone = sectionTone(section.key);
        const steps = stageCount(section);
        const on = section.key === activeKey;

        return (
          <Fragment key={section.key}>
            {index > 0 ? (
              <li
                aria-hidden
                className="hidden items-center px-1 text-muted-foreground lg:flex"
              >
                <IconChevronRight className="size-4" />
              </li>
            ) : null}
            <li className="min-w-0 lg:flex-1">
              <button
                type="button"
                onClick={() => onPick(section)}
                aria-current={on ? "step" : undefined}
                className={cn(
                  "flex h-full w-full items-start gap-2.5 rounded-lg border bg-card p-3 text-left transition-colors duration-150",
                  on
                    ? "border-primary ring-1 ring-primary"
                    : "border-border hover:border-primary/50",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                    TONE_BADGE[tone],
                  )}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-tight text-foreground">
                    {section.title}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                    {section.description}
                  </span>
                  {/* A branched part is two routes, not one long list — say so
                      here, or "9 steps" reads as nine things in a row. */}
                  <span className="mt-1 block text-xs tabular-nums text-muted-foreground">
                    {section.paths.length > 1
                      ? section.paths
                          .map((path) => `${path.stages.length}`)
                          .join(" or ") + " steps"
                      : `${steps} ${steps === 1 ? "step" : "steps"}`}
                  </span>
                </span>
              </button>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
