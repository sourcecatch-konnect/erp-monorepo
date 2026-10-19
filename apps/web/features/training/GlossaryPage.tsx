"use client";

import { useMemo, useState } from "react";
import { IconSearch } from "@tabler/icons-react";
import { Input } from "@skerp/ui/components/input";
import { TrainingNav } from "./components/TrainingNav";
import { GLOSSARY } from "./content/glossary";

const SORTED = [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term));

/** A3 — every ERP word in plain language, searchable. */
export function GlossaryPage() {
  const [query, setQuery] = useState("");

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SORTED;
    return SORTED.filter((entry) =>
      [entry.term, entry.fullName ?? "", entry.meaning].some((text) =>
        text.toLowerCase().includes(q),
      ),
    );
  }, [query]);

  return (
    <div className="max-w-4xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Glossary</h1>
        <p className="text-sm text-muted-foreground">
          The words you will see across the ERP, explained simply.
        </p>
      </header>

      <TrainingNav />

      <div className="grid gap-1.5">
        <label htmlFor="glossary-search" className="text-xs font-medium text-muted-foreground">
          Search for a word
        </label>
        <div className="relative max-w-md">
          <IconSearch
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="glossary-search"
            className="h-10 pl-9"
            placeholder="e.g. POD, demurrage, TDS"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {entries.length} of {GLOSSARY.length} words
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-md border border-border bg-card px-5 py-10 text-center">
          <p className="text-sm font-medium text-foreground">
            No words match &ldquo;{query.trim()}&rdquo;
          </p>
          <p className="text-sm text-muted-foreground">
            Try a shorter word, or ask your manager what it means.
          </p>
        </div>
      ) : (
        <dl className="divide-y divide-border rounded-md border border-border bg-card">
          {entries.map((entry) => (
            <div
              key={entry.id}
              id={`term-${entry.id}`}
              className="scroll-mt-24 px-5 py-4 target:bg-primary/5"
            >
              <dt className="text-sm font-semibold text-foreground">
                {entry.term}
                {entry.fullName ? (
                  <span className="font-normal text-muted-foreground"> · {entry.fullName}</span>
                ) : null}
              </dt>
              <dd className="mt-1 text-sm text-muted-foreground">{entry.meaning}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
