"use client";

import { useMemo, useState } from "react";
import { IconSearch } from "@tabler/icons-react";
import type { TrainingStageKey } from "@skerp/types";
import { Input } from "@skerp/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { MAIN_FLOW, SIDE_FLOWS, type MapSection } from "./content/process-map";
import { STAGE_CONTENT, STAGE_TERMS } from "./content/stages";
import { PlaybackNotice } from "./audio/PlayText";
import { SectionRail, TONE_BADGE, sectionTone } from "./components/SectionRail";
import { StageDetail } from "./components/StageDetail";
import { TrainingNav } from "./components/TrainingNav";
import { useCompleteOnVisit, useTrainingMe } from "./hooks/useTraining";
import { STAGE_BY_KEY } from "./lib/catalog-lookup";
import { cn } from "@skerp/ui/lib/util";

const MINE = "__mine__";
const NONE = "__none__";
const ALL_SECTIONS = [...MAIN_FLOW, ...SIDE_FLOWS];

const sectionOf = (key: TrainingStageKey) =>
  ALL_SECTIONS.find((section) =>
    section.paths.some((path) => path.stages.includes(key)),
  );

/** Everything searchable about a stage, flattened once. */
const HAYSTACK = new Map<TrainingStageKey, string>(
  ALL_SECTIONS.flatMap((section) =>
    section.paths.flatMap((path) =>
      path.stages.map((key) => {
        const stage = STAGE_BY_KEY.get(key);
        const content = STAGE_CONTENT[key];
        return [
          key,
          [
            stage?.title,
            stage?.summary,
            section.title,
            content?.explain,
            ...(STAGE_TERMS[key] ?? []),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase(),
        ] as const;
      }),
    ),
  ),
);

/** The areas that run alongside the main flow, as a pickable row. */
function SupportAreas({
  activeKey,
  onPick,
}: {
  activeKey: string | null;
  onPick: (section: MapSection) => void;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">
        Work that supports the business
      </h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        This happens every day, but not as a step in one order&apos;s journey.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {SIDE_FLOWS.map((section) => {
          const steps = section.paths.reduce(
            (total, path) => total + path.stages.length,
            0,
          );
          const on = section.key === activeKey;
          return (
            <button
              key={section.key}
              type="button"
              onClick={() => onPick(section)}
              aria-current={on ? "step" : undefined}
              className={cn(
                "flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors duration-150",
                on
                  ? "border-primary ring-1 ring-primary"
                  : "border-border hover:border-primary/50",
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-lg",
                  TONE_BADGE[sectionTone(section.key)],
                )}
              >
                <section.icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-tight text-foreground">
                  {section.title}
                </span>
                <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
                  {steps} {steps === 1 ? "step" : "steps"}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** A3 — the whole business as a rail, with one step open underneath it. */
export function ProcessMapPage() {
  const { data: me, isLoading, isError, error } = useTrainingMe();
  useCompleteOnVisit("/training/process-map");

  const [mode, setMode] = useState<string>(MINE);
  const [query, setQuery] = useState("");
  const [stageKey, setStageKey] = useState<TrainingStageKey>(
    MAIN_FLOW[1]?.paths[0]?.stages[0] ?? "setup.masters",
  );

  const roles = useMemo(
    () =>
      me ? [...new Set(me.stages.flatMap((stage) => stage.owners))].sort() : [],
    [me],
  );

  const owned = me ? me.stages.filter((stage) => stage.owned).length : 0;
  const canLook = me
    ? me.stages.filter((stage) => !stage.owned && stage.canOpen).length
    : 0;
  /**
   * Someone who can do nearly everything (an Admin) learns nothing from "your
   * steps" — the whole map lights up. The role picker is the useful control
   * for them, so say so rather than showing a map of all blue.
   */
  const ownsNearlyEverything =
    me !== undefined && me.stages.length > 0 && owned / me.stages.length >= 0.8;

  const section = sectionOf(stageKey) ?? MAIN_FLOW[0];

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return null;
    return [...HAYSTACK.entries()]
      .filter(([, text]) => text.includes(q))
      .map(([key]) => key);
  }, [query]);

  const open = (key: TrainingStageKey) => {
    setStageKey(key);
    setQuery("");
  };

  return (
    <div className="w-full space-y-4">
      <header className="space-y-0.5">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          How the business works
        </h1>
        <p className="text-sm text-muted-foreground">
          Understand each step, your part in it, and who takes over next.
        </p>
      </header>

      <TrainingNav />

      {isError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          We couldn&apos;t load the process map: {error.message}
        </p>
      ) : null}

      {isLoading || !me ? (
        isError ? null : (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        )
      ) : (
        <>
          <section className="rounded-lg border border-primary/25 bg-primary/5 px-4 py-3">
            <p className="text-sm font-semibold text-foreground">
              See how your work connects
            </p>
            <p className="text-sm text-muted-foreground">
              The numbered parts below are the order a job travels through. Pick
              a part, then a step, to see what happens there and who picks it up
              after you.
            </p>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-56 flex-1">
              <IconSearch
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a step or a word…"
                aria-label="Find a step"
                className="pl-9"
              />
            </div>
            <label
              htmlFor="map-highlight"
              className="text-sm text-muted-foreground"
            >
              Highlight steps for
            </label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger id="map-highlight" className="h-10 w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MINE}>Me ({me.role.name})</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
                <SelectItem value={NONE}>Nobody (plain map)</SelectItem>
              </SelectContent>
            </Select>
            {mode === MINE ? (
              <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="size-2.5 rounded-full bg-primary"
                  />
                  {owned} you do
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="size-2.5 rounded-full border border-muted-foreground"
                  />
                  {canLook} you can look at
                </span>
              </span>
            ) : null}
          </div>

          {ownsNearlyEverything && mode === MINE ? (
            <p className="rounded-lg border border-border bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground">
              Your role can do almost every step, so &ldquo;me&rdquo; marks
              nearly the whole map. Pick a role above to see what that team
              does.
            </p>
          ) : null}

          <PlaybackNotice />

          {hits ? (
            <section className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">
                {hits.length === 0
                  ? `Nothing matches “${query}”.`
                  : `${hits.length} ${hits.length === 1 ? "step matches" : "steps match"} “${query}”`}
              </p>
              {hits.length > 0 ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {hits.map((key) => {
                    const stage = STAGE_BY_KEY.get(key);
                    const owner = sectionOf(key);
                    if (!stage || !owner) return null;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => open(key)}
                        className="rounded-lg border border-border p-3 text-left transition-colors duration-150 hover:border-primary/50"
                      >
                        <span className="block text-sm font-semibold text-foreground">
                          {stage.title}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {owner.title}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </section>
          ) : (
            <>
              <SectionRail
                sections={MAIN_FLOW}
                activeKey={section?.key ?? null}
                onPick={(picked) => {
                  const first = picked.paths[0]?.stages[0];
                  if (first) open(first);
                }}
              />

              {section ? (
                <StageDetail
                  stageKey={stageKey}
                  section={section}
                  me={me}
                  onOpenStage={open}
                />
              ) : null}

              <SupportAreas
                activeKey={section?.key ?? null}
                onPick={(picked) => {
                  const first = picked.paths[0]?.stages[0];
                  if (first) open(first);
                }}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
