"use client";

import Link from "next/link";
import { IconFilter } from "@tabler/icons-react";
import type { DashboardFunnelStep } from "@skerp/types";
import { cn } from "@/lib/utils";
import { WidgetCard, WidgetEmpty } from "./WidgetCard";
import { FUNNEL_ROUTES } from "../routes";
import { count } from "./format";

/**
 * Order to bill, as counts on the real statuses. The gap between two steps is
 * the information: delivered minus acknowledged is how many signed LRs have
 * not come back to the office. Bars are scaled to the first step, so the
 * drop-off is read as width.
 */
export function FunnelCard({
  steps,
  periodLabel,
  className,
}: {
  steps: DashboardFunnelStep[];
  periodLabel: string;
  className?: string;
}) {
  // Scaled to the busiest step, not to the first one: LRs created in a period
  // can outnumber the orders confirmed in it (they come from earlier orders),
  // and a period with no new orders still has the rest of the funnel to show.
  const top = Math.max(0, ...steps.map((s) => s.count));

  return (
    <WidgetCard
      title="Order to bill"
      icon={IconFilter}
      meta={periodLabel}
      className={className}
      bodyClassName="flex flex-col justify-center gap-2"
    >
      {top === 0 ? (
        <WidgetEmpty>Nothing moved through this period yet.</WidgetEmpty>
      ) : (
        steps.map((step, i) => (
          <Link
            key={step.key}
            href={FUNNEL_ROUTES[step.key]}
            className="grid grid-cols-[5.5rem_1fr_2.25rem] items-center gap-2 rounded-sm transition-colors duration-150 hover:bg-muted/50"
          >
            <span className="truncate text-xs text-muted-foreground">
              {step.label}
            </span>
            <span className="h-3.5 overflow-hidden rounded-sm bg-muted">
              <span
                className={cn(
                  "block h-full rounded-sm",
                  // The last two steps are paperwork rather than movement, so
                  // they read a shade back from the operational ones.
                  i >= 4 ? "bg-primary/55" : "bg-primary",
                )}
                style={{
                  width: `${Math.min(Math.max((step.count / top) * 100, step.count > 0 ? 2 : 0), 100)}%`,
                }}
              />
            </span>
            <span className="text-right text-sm font-medium tabular-nums text-foreground">
              {count(step.count)}
            </span>
          </Link>
        ))
      )}
    </WidgetCard>
  );
}
