"use client";

import { IconAlertTriangle } from "@tabler/icons-react";
import type { DashboardClaims } from "@skerp/types";
import { cn } from "@/lib/utils";
import { WidgetCard } from "./WidgetCard";
import { count, exactMoney, shortMoney } from "./format";
import { DASHBOARD_ROUTES } from "../routes";

/**
 * Damage claims: how many are still open and what they could cost, and what
 * damage cost this month after recoveries (claims C8).
 */
export function ClaimsCard({
  data,
  className,
}: {
  data: DashboardClaims;
  className?: string;
}) {
  const openClaimed = Number(data.openClaimedPaise);
  const netLoss = Number(data.netLossThisMonthPaise);

  return (
    <WidgetCard
      title="Damage claims"
      icon={IconAlertTriangle}
      meta="live total"
      href={DASHBOARD_ROUTES.claims}
      className={className}
    >
      {data.openCount === 0 && data.settledThisMonthCount === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          No open damage claims, and none settled this month.
        </p>
      ) : (
        <>
          <p className="text-2xl font-semibold tabular-nums text-foreground">
            {count(data.openCount)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            open {data.openCount === 1 ? "claim" : "claims"}
          </p>

          <dl className="mt-3 space-y-1.5 border-t pt-2.5 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">Claimed, not yet settled</dt>
              <dd className="font-medium tabular-nums text-foreground" title={exactMoney(openClaimed)}>
                {shortMoney(openClaimed)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">
                Net loss this month
                <span className="block text-xs">
                  {count(data.settledThisMonthCount)} settled, after recoveries
                </span>
              </dt>
              <dd
                className={cn(
                  "font-medium tabular-nums",
                  netLoss > 0 ? "text-warning" : "text-foreground",
                )}
                title={exactMoney(netLoss)}
              >
                {shortMoney(netLoss)}
              </dd>
            </div>
          </dl>
        </>
      )}
    </WidgetCard>
  );
}
