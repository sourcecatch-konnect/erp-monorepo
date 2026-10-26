"use client";

import { IconClockHour4 } from "@tabler/icons-react";
import type { DashboardAgeing, DashboardAgeingBucketKey } from "@skerp/types";
import { WidgetCard, WidgetEmpty } from "./WidgetCard";
import { count, exactMoney, shortMoney } from "./format";
import { DASHBOARD_ROUTES } from "../routes";

/**
 * Receivables ageing. The buckets run from on-time to badly overdue, so the
 * colour runs with them: primary, then warning, then destructive. Colour here
 * is severity, not decoration (design.md §3).
 */
const BUCKET_COLOR: Record<DashboardAgeingBucketKey, string> = {
  "0-30": "var(--primary)",
  "31-60": "var(--warning)",
  "61-90": "color-mix(in oklab, var(--destructive) 62%, transparent)",
  "90+": "var(--destructive)",
};

export function AgeingCard({
  data,
  className,
}: {
  data: DashboardAgeing;
  className?: string;
}) {
  const total = data.totalPaise;

  return (
    <WidgetCard
      title="Receivables ageing"
      icon={IconClockHour4}
      meta={
        total > 0 ? (
          <span className="tabular-nums" title={exactMoney(total)}>
            {shortMoney(total)}
          </span>
        ) : undefined
      }
      href={DASHBOARD_ROUTES.ageing}
      className={className}
      bodyClassName="flex flex-col gap-3"
    >
      {total === 0 ? (
        <WidgetEmpty>Nothing outstanding — every bill is settled.</WidgetEmpty>
      ) : (
        <>
          <div
            className="flex h-4 gap-px overflow-hidden rounded-sm"
            aria-hidden="true"
          >
            {data.buckets.map((bucket) =>
              bucket.amountPaise > 0 ? (
                <span
                  key={bucket.key}
                  style={{
                    width: `${(bucket.amountPaise / total) * 100}%`,
                    background: BUCKET_COLOR[bucket.key],
                  }}
                />
              ) : null,
            )}
          </div>
          <ul className="flex flex-col gap-1.5">
            {data.buckets.map((bucket) => (
              <li key={bucket.key} className="flex items-center gap-2 text-sm">
                <span
                  className="size-2 shrink-0 rounded-sm"
                  style={{ background: BUCKET_COLOR[bucket.key] }}
                  aria-hidden="true"
                />
                <span className="text-foreground">{bucket.label}</span>
                <span className="flex-1 truncate text-xs text-muted-foreground">
                  {count(bucket.billCount)}{" "}
                  {bucket.billCount === 1 ? "bill" : "bills"}
                </span>
                <span
                  className="font-medium tabular-nums text-foreground"
                  title={exactMoney(bucket.amountPaise)}
                >
                  {shortMoney(bucket.amountPaise)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </WidgetCard>
  );
}
