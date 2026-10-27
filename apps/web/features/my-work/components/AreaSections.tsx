"use client";

import * as React from "react";
import {
  IconChevronDown,
  IconChevronRight,
  IconCircleCheck,
  IconExternalLink,
} from "@tabler/icons-react";
import { useQueries } from "@tanstack/react-query";
import { Skeleton } from "@skerp/ui/components/skeleton";
import type {
  MyWorkModule,
  MyWorkPriorityRow,
  MyWorkQueue,
} from "@skerp/types";
import { cn } from "@/lib/utils";
import { myWorkApi, type MyWorkListFilter } from "../my-work.service";
import { myWorkKeys } from "../my-work.keys";
import { MODULES, type ModuleDef } from "./modules";
import { MyWorkRowItem } from "./MyWorkRowItem";
import { QUICK_BY_QUEUE, type QuickAction } from "./quick";

/** Rows shown inside an open section before "show all" takes over. */
const PER_AREA = 5;
/** Sections opened on arrival; the rest start closed so the page stays short. */
const OPEN_BY_DEFAULT = 2;

/**
 * The worklist grouped by work area — Orders, LR & delivery, Rail & rake,
 * Billing, Payments, Trips, Workshop — which is how people actually sit down
 * to clear work: by the kind of job, not by one merged ranking.
 *
 * Each area is fetched separately rather than slicing one ranked page. A
 * single paged list can only group the rows it happens to be holding, so a
 * header reading "Billing 9" could sit above two rows, or none, depending on
 * where the cross-area ranking put them. One request per open area costs more
 * round-trips and buys headers that are true.
 *
 * Ranking has not been lost, it moved: "Do first" above this block is ordered
 * across every area, which is exactly what grouping gives up. Read together,
 * that block answers "what now" and these sections answer "what else".
 */
export function AreaSections({
  queues,
  branch,
  onArea,
  onQuick,
}: {
  queues: MyWorkQueue[];
  branch: string | null;
  /** Switch the page to one area's full, paged, filterable list. */
  onArea: (module: MyWorkModule) => void;
  onQuick: (action: QuickAction) => void;
}) {
  // Counts come from the overview the page already loaded, so a header reads
  // correctly before its own rows arrive — and stays correct while collapsed.
  const areas = MODULES.map((def) => {
    const mine = queues.filter((q) => q.module === def.key);
    return {
      def,
      waiting: mine.reduce((n, q) => n + q.waiting, 0),
      late: mine.reduce((n, q) => n + q.late, 0),
    };
  }).filter((area) => area.waiting > 0);

  const [open, setOpen] = React.useState<Set<MyWorkModule> | null>(null);
  // Until the user touches anything, the areas under most pressure are open.
  const expanded = React.useMemo(() => {
    if (open) return open;
    return new Set(
      [...areas]
        .sort((a, b) => b.late - a.late || b.waiting - a.waiting)
        .slice(0, OPEN_BY_DEFAULT)
        .map((area) => area.def.key),
    );
    // `areas` is derived from `queues` each render; the counts are what matter.
  }, [open, queues]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (key: MyWorkModule) => {
    const next = new Set(expanded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setOpen(next);
  };

  const results = useQueries({
    queries: areas.map((area) => {
      const filter: MyWorkListFilter = {
        module: area.def.key,
        queue: null,
        urgency: "all",
        scope: "active",
        search: "",
        branch,
      };
      return {
        queryKey: myWorkKeys.list(filter, 0, PER_AREA),
        queryFn: () => myWorkApi.list(filter, 0, PER_AREA),
        // A closed section has nothing to show, so it fetches nothing.
        enabled: expanded.has(area.def.key),
        refetchInterval: 60_000,
      };
    }),
  });

  if (areas.length === 0) {
    return (
      <section className="flex flex-col items-center gap-2 rounded-lg border bg-card px-4 py-14 text-center">
        <IconCircleCheck className="size-10 text-success" aria-hidden="true" />
        <p className="text-base font-semibold text-foreground">All caught up</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Nothing is waiting on you in any area. New work shows up as orders,
          LRs and bills move forward.
        </p>
      </section>
    );
  }

  return (
    <div className="divide-y overflow-hidden rounded-lg border bg-card">
      {areas.map((area, i) => (
        <AreaSection
          key={area.def.key}
          def={area.def}
          waiting={area.waiting}
          late={area.late}
          open={expanded.has(area.def.key)}
          rows={results[i]?.data?.rows ?? []}
          loading={results[i]?.isPending ?? false}
          onToggle={() => toggle(area.def.key)}
          onShowAll={() => onArea(area.def.key)}
          onQuick={onQuick}
        />
      ))}
    </div>
  );
}

function AreaSection({
  def,
  waiting,
  late,
  open,
  rows,
  loading,
  onToggle,
  onShowAll,
  onQuick,
}: {
  def: ModuleDef;
  waiting: number;
  late: number;
  open: boolean;
  rows: MyWorkPriorityRow[];
  loading: boolean;
  onToggle: () => void;
  onShowAll: () => void;
  onQuick: (action: QuickAction) => void;
}) {
  const IconCmp = def.icon;
  const Chevron = open ? IconChevronDown : IconChevronRight;

  return (
    <section>
      <h3>
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className={cn(
            "flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors duration-150 hover:bg-muted/50",
            open && "bg-muted/30",
          )}
        >
          <Chevron className="size-4 shrink-0 text-muted-foreground" />
          <IconCmp className="size-4 shrink-0 text-muted-foreground" />
          <span className="shrink-0 text-sm font-semibold text-foreground">
            {def.label}
          </span>
          <span className="hidden truncate text-xs text-muted-foreground sm:inline">
            {def.covers}
          </span>
          <span className="ms-auto flex shrink-0 items-center gap-3">
            {late > 0 ? (
              <span className="text-xs font-medium tabular-nums text-destructive">
                {late.toLocaleString("en-IN")} late
              </span>
            ) : null}
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {waiting.toLocaleString("en-IN")}
            </span>
          </span>
        </button>
      </h3>

      {!open ? null : loading ? (
        <div className="space-y-2 border-t px-4 py-3">
          {Array.from({ length: Math.min(waiting, 3) }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <>
          <ul className="divide-y border-t">
            {rows.map((row) => {
              const kind = QUICK_BY_QUEUE[row.queueKey];
              return (
                <MyWorkRowItem
                  key={`${row.queueKey}:${row.id}`}
                  row={row}
                  actionLabel={row.actionLabel}
                  lateAfterDays={row.lateAfterDays}
                  queueTitle={row.queueTitle}
                  onAction={
                    kind
                      ? () =>
                          onQuick({
                            kind,
                            id: row.id,
                            number: row.number,
                            row,
                          })
                      : undefined
                  }
                />
              );
            })}
          </ul>

          {waiting > rows.length ? (
            <div className="border-t px-4 py-2.5">
              <button
                type="button"
                onClick={onShowAll}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors duration-150 hover:underline"
              >
                Show all {waiting.toLocaleString("en-IN")} in {def.label}
                <IconExternalLink className="size-3.5" />
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
