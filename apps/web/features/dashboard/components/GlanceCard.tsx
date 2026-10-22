"use client";

import { IconLayoutGrid } from "@tabler/icons-react";
import type { DashboardGlance } from "@skerp/types";
import { cn } from "@/lib/utils";
import { WidgetCard } from "./WidgetCard";
import { count, exactMoney, shortMoney } from "./format";

/**
 * Four figures in one card, divided by hairlines rather than split into four
 * separate boxes — four cards of equal weight read as noise, one cluster reads
 * as a group. A cell the viewer has no permission for prints a dash.
 */
export function GlanceCard({
  data,
  periodLabel,
  className,
}: {
  data: DashboardGlance;
  periodLabel: string;
  className?: string;
}) {
  const cells: CellData[] = [
    {
      label: "Collected",
      value:
        data.collectedPaise === null ? null : shortMoney(data.collectedPaise),
      exact:
        data.collectedPaise === null
          ? undefined
          : exactMoney(data.collectedPaise),
      sub: "receipts posted",
    },
    {
      label: "Outstanding",
      value:
        data.outstandingPaise === null
          ? null
          : shortMoney(data.outstandingPaise),
      exact:
        data.outstandingPaise === null
          ? undefined
          : exactMoney(data.outstandingPaise),
      // Deliberately not period-filtered: this is every open bill today.
      sub: "all open bills",
    },
    {
      label: "Trips running",
      value: data.tripsRunning === null ? null : count(data.tripsRunning),
      // null is "no access", not "none" — don't claim a figure we never read.
      sub:
        data.tripsClosingToday === null
          ? ""
          : data.tripsClosingToday > 0
            ? `${count(data.tripsClosingToday)} due today`
            : "none due today",
    },
    {
      label: "Bills to review",
      value:
        data.billsPendingReview === null
          ? null
          : count(data.billsPendingReview),
      sub: "awaiting approval",
    },
  ];

  // Hairlines only between cells, so the card keeps one outer border.
  const edges = ["border-b border-r", "border-b", "border-r", ""];

  return (
    <WidgetCard
      title="At a glance"
      icon={IconLayoutGrid}
      meta={periodLabel}
      className={className}
      bodyClassName="grid grid-cols-2 grid-rows-2 p-0"
    >
      {cells.map((cell, i) => (
        <Cell key={cell.label} {...cell} className={edges[i]} />
      ))}
    </WidgetCard>
  );
}

type CellData = {
  label: string;
  /** null = the viewer has no permission for this figure. */
  value: string | null;
  exact?: string;
  sub: string;
};

function Cell({
  label,
  value,
  exact,
  sub,
  className,
}: CellData & { className?: string }) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col justify-center gap-0.5 px-3.5 py-2.5",
        className,
      )}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      {value === null ? (
        <span className="text-sm text-muted-foreground" title="No access">
          —
        </span>
      ) : (
        <span
          className="truncate text-lg font-semibold tracking-tight tabular-nums text-foreground"
          title={exact}
        >
          {value}
        </span>
      )}
      <span className="truncate text-xs text-muted-foreground">{sub}</span>
    </div>
  );
}
