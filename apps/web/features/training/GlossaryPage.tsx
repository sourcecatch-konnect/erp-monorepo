"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { IconArrowRight, IconSearch } from "@tabler/icons-react";
import type { TrainingStageKey } from "@skerp/types";
import { Input } from "@skerp/ui/components/input";
import { cn } from "@skerp/ui/lib/util";
import { TrainingNav } from "./components/TrainingNav";
import {
  AREA_TONES,
  GLOSSARY,
  GLOSSARY_AREAS,
  type GlossaryArea,
} from "./content/glossary";
import { STAGE_TERMS } from "./content/stages";
import { useCompleteOnVisit } from "./hooks/useTraining";
import { STAGE_BY_KEY } from "./lib/catalog-lookup";

const SORTED = [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term));

const TONE_CHIP: Record<1 | 2 | 3 | 4 | 5 | 6, string> = {
  1: "bg-learn-1-soft text-learn-1",
  2: "bg-learn-2-soft text-learn-2",
  3: "bg-learn-3-soft text-learn-3",
  4: "bg-learn-4-soft text-learn-4",
  5: "bg-learn-5-soft text-learn-5",
  6: "bg-learn-6-soft text-learn-6",
};

/**
 * Which business steps use each word — the reverse of STAGE_TERMS, built once.
 * No new content: the mapping already exists, it was just only readable in one
 * direction.
 */
const USED_IN = new Map<string, TrainingStageKey[]>();
for (const [stageKey, ids] of Object.entries(STAGE_TERMS)) {
  for (const id of ids ?? []) {
    const list = USED_IN.get(id) ?? [];
    list.push(stageKey as TrainingStageKey);
    USED_IN.set(id, list);
  }
}

const AREA_LABEL = new Map(
  GLOSSARY_AREAS.map((area) => [area.key, area.label]),
);

const ALL = "__all__";

/** A3 — every ERP word in plain language, searchable and tagged by area. */
export function GlossaryPage() {
  useCompleteOnVisit("/training/glossary");
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<GlossaryArea | typeof ALL>(ALL);

  const counts = useMemo(() => {
    const map = new Map<GlossaryArea, number>();
    for (const entry of GLOSSARY)
      map.set(entry.area, (map.get(entry.area) ?? 0) + 1);
    return map;
  }, []);

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SORTED.filter((entry) => {
      if (area !== ALL && entry.area !== area) return false;
      if (!q) return true;
      return [entry.term, entry.fullName ?? "", entry.meaning].some((text) =>
        text.toLowerCase().includes(q),
      );
    });
  }, [query, area]);

  return (
    <div className="w-full space-y-4">
      <header className="space-y-0.5">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Glossary
        </h1>
        <p className="text-sm text-muted-foreground">
          Every word the ERP uses, explained in plain language.
        </p>
      </header>

      <TrainingNav />

      <section className="rounded-lg border border-primary/25 bg-primary/5 px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Search for a word, or pick the part of the business you work in. You
          can also click any underlined word anywhere in training to see its
          meaning without leaving the page.
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <IconSearch
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="glossary-search"
            className="h-10 pl-9"
            placeholder="e.g. POD, demurrage, TDS"
            aria-label="Search for a word"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <p
          className="text-xs tabular-nums text-muted-foreground"
          aria-live="polite"
        >
          {entries.length} of {GLOSSARY.length} words
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setArea(ALL)}
          aria-pressed={area === ALL}
          className={cn(
            "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors duration-150",
            area === ALL
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          All words ({GLOSSARY.length})
        </button>
        {GLOSSARY_AREAS.map((item) => {
          const on = area === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setArea(on ? ALL : item.key)}
              aria-pressed={on}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors duration-150",
                on
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label} ({counts.get(item.key) ?? 0})
            </button>
          );
        })}
      </div>

      {entries.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-5 py-10 text-center">
          <p className="text-sm font-medium text-foreground">
            No words match {query.trim() ? `“${query.trim()}”` : "that filter"}
          </p>
          <p className="text-sm text-muted-foreground">
            Try a shorter word, or clear the filter above.
          </p>
        </div>
      ) : (
        <dl className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {entries.map((entry) => {
            const tone = AREA_TONES[entry.area];
            const usedIn = USED_IN.get(entry.id) ?? [];

            return (
              <div
                key={entry.id}
                id={`term-${entry.id}`}
                className="scroll-mt-24 rounded-lg border border-border bg-card p-4 transition-colors duration-150 target:border-primary"
              >
                <dt className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  {/* The word is what the eye should land on — this page
                      exists to find one, so it leads at a larger size. */}
                  <span className="text-base font-semibold text-foreground">
                    {entry.term}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      TONE_CHIP[tone],
                    )}
                  >
                    {AREA_LABEL.get(entry.area)}
                  </span>
                  {entry.fullName ? (
                    <span className="w-full text-xs text-muted-foreground">
                      {entry.fullName}
                    </span>
                  ) : null}
                </dt>
                <dd className="mt-2 text-sm text-muted-foreground">
                  {entry.meaning}
                </dd>

                {usedIn.length > 0 ? (
                  <div className="mt-3 border-t border-border pt-2.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      Used in
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {usedIn.map((stageKey) => {
                        const stage = STAGE_BY_KEY.get(stageKey);
                        if (!stage) return null;
                        return (
                          <li key={stageKey}>
                            <Link
                              href="/training/process-map"
                              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            >
                              <IconArrowRight className="size-3" aria-hidden />
                              {stage.title}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </div>
            );
          })}
        </dl>
      )}
    </div>
  );
}
