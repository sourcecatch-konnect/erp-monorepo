"use client";

import { IconChartArrowsVertical } from "@tabler/icons-react";
import type { DashboardProfit } from "@skerp/types";
import { cn } from "@/lib/utils";
import { WidgetCard } from "./WidgetCard";
import { count, deltaLabel, exactMoney, shortMoney } from "./format";

/**
 * Did the work make money? Revenue says what was billed; this says what was
 * left after each journey paid for itself — freight earned, less diesel,
 * advances, tolls and the rest, from the posted log slips.
 *
 * A log slip belongs to a journey, not a branch, so the figure is always
 * company-wide. The card says so when the page is filtered, rather than
 * letting the number read as one branch's profit.
 */
export function ProfitCard({
  data,
  periodLabel,
  branchFiltered = false,
  className,
}: {
  data: DashboardProfit;
  periodLabel: string;
  branchFiltered?: boolean;
  className?: string;
}) {
  const net = Number(data.netPaise);
  const freight = Number(data.freightPaise);
  const expense = Number(data.expensePaise);
  const delta = deltaLabel(data.deltaPct);
  const positive = net >= 0;

  return (
    <WidgetCard
      title="Journey profit"
      icon={IconChartArrowsVertical}
      meta={`${periodLabel}${branchFiltered ? " · all branches" : ""}`}
      className={className}
    >
      {data.journeyCount === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          No journeys closed in this period yet. The figure appears once a log
          slip is posted to accounts.
        </p>
      ) : (
        <>
          <p
            className={cn(
              "text-2xl font-semibold tabular-nums",
              positive ? "text-foreground" : "text-destructive",
            )}
            title={exactMoney(net)}
          >
            {shortMoney(net)}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span>
              {data.marginPct !== null
                ? `${data.marginPct}% of freight`
                : "No freight earned"}
            </span>
            {delta ? (
              <span
                className={cn(
                  "font-medium",
                  data.deltaPct !== null && data.deltaPct >= 0
                    ? "text-success"
                    : "text-destructive",
                )}
              >
                {delta}
              </span>
            ) : null}
          </p>

          <dl className="mt-3 space-y-1.5 border-t pt-2.5 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">Freight earned</dt>
              <dd
                className="font-medium tabular-nums text-foreground"
                title={exactMoney(freight)}
              >
                {shortMoney(freight)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">Journey costs</dt>
              <dd
                className="font-medium tabular-nums text-foreground"
                title={exactMoney(expense)}
              >
                −{shortMoney(expense)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">Journeys closed</dt>
              <dd className="font-medium tabular-nums text-foreground">
                {count(data.journeyCount)}
              </dd>
            </div>
          </dl>
        </>
      )}
    </WidgetCard>
  );
}
