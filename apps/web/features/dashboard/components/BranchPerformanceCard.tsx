"use client";

import { IconBuildingStore } from "@tabler/icons-react";
import type { DashboardBranchRow } from "@skerp/types";
import { cn } from "@/lib/utils";
import { WidgetCard, WidgetEmpty } from "./WidgetCard";
import { exactMoney, shortMoney } from "./format";
import { DASHBOARD_ROUTES } from "../routes";

/** Below this, a branch is billing work it is not turning into cash. */
const WEAK_COLLECTION_PCT = 70;
/** A tile, not a report — more rows than this belongs on the branch master. */
const SHOW = 5;

/**
 * Branch performance — which branch is billing well but not collecting.
 *
 * Deliberately a tile rather than a table. The six-column version read as a
 * report dropped into a dashboard: it forced a full-width row of its own and
 * repeated figures the money cards already carry. Here each branch is one
 * line — a bar for relative size, the collection rate, and overdue in red —
 * which is all that is needed to spot the branch worth asking about. The
 * detail lives on the branch master behind the card's drill-in.
 */
export function BranchPerformanceCard({
  rows,
  periodLabel,
  className,
}: {
  rows: DashboardBranchRow[];
  periodLabel: string;
  className?: string;
}) {
  // Every branch in scope, not only the ones that billed. A branch that
  // raised nothing this month is itself the finding — hiding it made the card
  // look like the company has fewer branches than it does.
  const active = rows.slice(0, SHOW);
  const peak = Math.max(1, ...active.map((r) => r.billedPaise));
  const silent = active.filter((r) => r.billedPaise === 0).length;

  return (
    <WidgetCard
      title="Branch performance"
      icon={IconBuildingStore}
      meta={periodLabel}
      href={DASHBOARD_ROUTES.branches}
      className={className}
      bodyClassName="flex flex-col justify-center gap-2"
    >
      {active.length === 0 ? (
        <WidgetEmpty>No branches in your access.</WidgetEmpty>
      ) : (
        <ul className="flex flex-col gap-2">
          {active.map((row) => {
            const weak =
              row.collectionPct !== null &&
              row.collectionPct < WEAK_COLLECTION_PCT;
            return (
              <li key={row.branchId} className="flex items-center gap-2">
                <span className="w-20 shrink-0 truncate text-xs text-foreground">
                  {row.name}
                </span>

                <span
                  className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-sm bg-muted"
                  title={`Billed ${exactMoney(row.billedPaise)}`}
                  aria-hidden="true"
                >
                  <span
                    className={cn(
                      "block h-full",
                      row.billedPaise > 0 ? "bg-primary" : "bg-transparent",
                    )}
                    style={{ width: `${(row.billedPaise / peak) * 100}%` }}
                  />
                </span>

                <span
                  className={cn(
                    "w-10 shrink-0 text-right text-xs tabular-nums",
                    weak
                      ? "font-medium text-destructive"
                      : "text-muted-foreground",
                  )}
                  title="Received this period against billed this period. Receipts can settle older bills, so this can pass 100%."
                >
                  {row.collectionPct === null ? "—" : `${row.collectionPct}%`}
                </span>

                <span
                  className={cn(
                    "w-16 shrink-0 text-right text-xs font-medium tabular-nums",
                    row.overduePaise > 0
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                  title={`Overdue ${exactMoney(row.overduePaise)}`}
                >
                  {shortMoney(row.overduePaise)}
                </span>
              </li>
            );
          })}

          <li className="mt-0.5 flex items-center gap-2 border-t pt-1.5 text-xs text-muted-foreground">
            <span className="w-20 shrink-0">Branch</span>
            <span className="min-w-0 flex-1">
              {silent > 0 ? `${silent} billed nothing` : "Billed"}
            </span>
            <span className="w-10 shrink-0 text-right">Coll.</span>
            <span className="w-16 shrink-0 text-right">Overdue</span>
          </li>
        </ul>
      )}
    </WidgetCard>
  );
}
