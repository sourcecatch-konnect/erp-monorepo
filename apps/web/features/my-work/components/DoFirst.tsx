"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { Skeleton } from "@skerp/ui/components/skeleton";
import type { MyWorkPriorityRow } from "@skerp/types";
import { formatPaiseCompact } from "@/lib/money";
import { cn } from "@/lib/utils";
import { myWorkApi } from "../my-work.service";
import { myWorkKeys } from "../my-work.keys";
import { ActionButton } from "./ActionButton";
import { QUICK_BY_QUEUE, type QuickAction } from "./quick";
import { dueText, rowUrgency } from "./urgency";
import {
  IconBolt,
  IconCircleCheck,
} from "@tabler/icons-react";
/**
 * Three, because this is a decision and not a list. A fourth row would push
 * the rail past a laptop viewport, and the grouped areas already hold the rest.
 */
const SHOW = 3;
/**
 * Ranking alone put three near-identical draft bills from one queue at the
 * top — true, and useless: finishing them is one job, not three decisions. We
 * take a deeper page and keep the worst item from each queue, so the panel
 * shows three different kinds of work.
 */
const FETCH = 24;

/**
 * "Do first" — the items furthest past their own step's time limit, ranked
 * across every area at once.
 *
 * The worklist beside this is grouped by area, which is how people clear work
 * but means the first row on screen belongs to whichever area sorts first, not
 * to whatever is most overdue. This panel is the counterweight: same endpoint,
 * same ranking, no area filter, so the worst item in the business is always in
 * view — it sits in a sticky rail precisely so it cannot scroll away.
 *
 * Rows are laid out for a narrow column: urgency, then what and whose, then a
 * full-width button. The wide row used in the list would wrap awkwardly here.
 */
export function DoFirst({
  branch,
  onQuick,
  className,
}: {
  branch: string | null;
  onQuick: (action: QuickAction) => void;
  className?: string;
}) {
  const filter = {
    module: null,
    queue: null,
    urgency: "all",
    scope: "active",
    search: "",
    branch,
  } as const;

  const { data, isPending } = useQuery({
    queryKey: myWorkKeys.list(filter, 0, FETCH),
    queryFn: () => myWorkApi.list(filter, 0, FETCH),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  // Rows arrive most-overdue first, so the first of each queue is that queue's
  // worst. If fewer than three queues have anything, the rest of the page is
  // filled from the ranking as it stands.
  const picked: MyWorkPriorityRow[] = [];
  const seen = new Set<string>();
  for (const row of data?.rows ?? []) {
    if (seen.has(row.queueKey)) continue;
    seen.add(row.queueKey);
    picked.push(row);
    if (picked.length === SHOW) break;
  }
  if (picked.length < SHOW) {
    for (const row of data?.rows ?? []) {
      if (picked.includes(row)) continue;
      picked.push(row);
      if (picked.length === SHOW) break;
    }
  }

  if (isPending) {
    return (
      <section className={cn("rounded-lg border bg-card", className)}>
        <div className="border-b px-4 py-2.5">
          <Skeleton className="h-5 w-28" />
        </div>
        <div className="space-y-3 p-4">
          {Array.from({ length: SHOW }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </section>
    );
  }

  if (picked.length === 0) {
    return (
      <section
        aria-label="Do first"
        className={cn(
          "flex flex-col items-center gap-2 rounded-lg border bg-card px-4 py-8 text-center",
          className,
        )}
      >
        <IconCircleCheck className="size-8 text-success" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">Nothing urgent</p>
        <p className="text-xs text-muted-foreground">
          Nothing is past its time limit. Work through the areas when you can.
        </p>
      </section>
    );
  }
  return (
    <section
      aria-labelledby="do-first-heading"
      className={cn(
        "overflow-hidden rounded-xl border bg-card",
        className,
      )}
    >
      <header className="flex items-start gap-3 border-b px-4 py-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <IconBolt className="size-5" aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h2
              id="do-first-heading"
              className="text-sm font-semibold text-foreground"
            >
              Do first
            </h2>

            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
              {picked.length} tasks
            </span>
          </div>

          <p className="mt-1 text-xs text-muted-foreground">
            Your next priorities across every area.
          </p>
        </div>
      </header>
      <ol className="space-y-3 bg-muted/20 p-3">
        {picked.map((row, i) => (
          <RailRow
            key={`${row.queueKey}:${row.id}`}
            row={row}
            rank={i + 1}
            primary={i === 0}
            onQuick={onQuick}
          />
        ))}
      </ol>
    </section>
  );
}
function RailRow({
  row,
  rank,
  primary,
  onQuick,
}: {
  row: MyWorkPriorityRow;
  rank: number;
  primary: boolean;
  onQuick: (action: QuickAction) => void;
}) {
  const urgency = rowUrgency(
    row.ageDays,
    row.lateAfterDays,
    row.isLate,
  );

  const timing = dueText(
    row.ageDays,
    row.lateAfterDays,
    row.isLate,
  );

  const kind = QUICK_BY_QUEUE[row.queueKey];

  const amount =
    row.amountPaise !== null
      ? formatPaiseCompact(Number(row.amountPaise))
      : null;

  return (
    <li
      className={cn(
        "min-w-0 rounded-lg border bg-card p-4",
        primary ? "border-primary/30" : "border-border",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Priority number */}
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums",
            primary
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          <span className="sr-only">Priority </span>
          {rank}
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-5 text-foreground">
            {row.queueTitle}
          </h3>

          <span
            className={cn(
              "mt-1 inline-block rounded px-1.5 py-0.5 text-xs font-medium",
              urgency === "verylate"
                ? "bg-destructive/10 text-destructive"
                : urgency === "late"
                  ? "bg-warning/10 text-warning"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {timing}
          </span>
        </div>
      </div>

      {/* Task details */}
      <p className="mt-3 break-words text-sm leading-5 text-foreground">
        {row.party}
      </p>

      <Link
        href={row.recordHref}
        className="mt-1 block break-all text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {row.number}
      </Link>

      {/* Amount and visible action */}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t pt-3">
        {amount ? (
          <span className="mr-auto text-sm font-semibold tabular-nums text-foreground">
            {amount}
          </span>
        ) : null}

        <div className="[&>*]:min-h-9 [&>*]:min-w-24 [&>*]:rounded-md [&>*]:px-4">
          {kind ? (
            <ActionButton
              label={row.actionLabel}
              primary={primary}
              onClick={() =>
                onQuick({
                  kind,
                  id: row.id,
                  number: row.number,
                  row,
                })
              }
            />
          ) : (
            <ActionButton
              label={row.actionLabel}
              href={row.href}
              primary={primary}
            />
          )}
        </div>
      </div>
    </li>
  );
}