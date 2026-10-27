"use client";

import { IconArrowsExchange } from "@tabler/icons-react";
import type { DashboardPayables } from "@skerp/types";
import { cn } from "@/lib/utils";
import { WidgetCard } from "./WidgetCard";
import { count, exactMoney, shortMoney } from "./format";
import { DASHBOARD_ROUTES } from "../routes";

/**
 * What SK owes. Outstanding and Overdue on this page are what customers owe
 * us; without this card the money picture is one-sided, and an owner cannot
 * read their actual position from it.
 *
 * Only approved and part-paid slips count: a draft or a slip still waiting
 * for approval is not yet a commitment.
 */
export function PayablesCard({
  data,
  className,
}: {
  data: DashboardPayables;
  className?: string;
}) {
  const outstanding = Number(data.outstandingPaise);
  const overdue = Number(data.overduePaise);

  return (
    <WidgetCard
      title="We owe vendors"
      icon={IconArrowsExchange}
      meta="live total"
      href={DASHBOARD_ROUTES.vendorPayments}
      className={className}
    >
      {data.slipCount === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          Nothing approved and unpaid. Transporters, brokers and hamali are all
          settled.
        </p>
      ) : (
        <>
          <p
            className="text-2xl font-semibold tabular-nums text-foreground"
            title={exactMoney(outstanding)}
          >
            {shortMoney(outstanding)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            across {count(data.slipCount)}{" "}
            {data.slipCount === 1 ? "approved slip" : "approved slips"}
          </p>

          <dl className="mt-3 space-y-1.5 border-t pt-2.5 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">
                Approved over 30 days ago
              </dt>
              <dd
                className={cn(
                  "font-medium tabular-nums",
                  overdue > 0 ? "text-warning" : "text-foreground",
                )}
                title={exactMoney(overdue)}
              >
                {shortMoney(overdue)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">Slips waiting</dt>
              <dd className="font-medium tabular-nums text-foreground">
                {count(data.overdueCount)}
              </dd>
            </div>
          </dl>
        </>
      )}
    </WidgetCard>
  );
}
