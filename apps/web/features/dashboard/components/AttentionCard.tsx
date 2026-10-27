"use client";

import Link from "next/link";
import {
  IconAlertTriangle,
  IconChevronRight,
  IconCircleCheck,
} from "@tabler/icons-react";
import type {
  DashboardAttentionRow,
  DashboardAttentionSeverity,
} from "@skerp/types";
import { cn } from "@/lib/utils";
import { exactMoney, shortMoney } from "./format";
import { WidgetCard } from "./WidgetCard";
import { ATTENTION_ROUTES } from "../routes";

/**
 * Exceptions — the things nobody has a queue for: freight sitting in transit
 * too long, delivered work never billed, a customer past its credit limit.
 * Severity is carried by a stripe as well as by colour, so it survives a
 * colour-blind reader (design.md §9).
 *
 * The card spans the page and grows with its rows. It used to sit in a
 * fixed-height grid cell and scroll behind a hidden scrollbar, which meant a
 * sixth exception could not be seen at all.
 */
const STRIPE: Record<DashboardAttentionSeverity, string> = {
  critical: "bg-destructive",
  warning: "bg-warning",
  info: "bg-primary",
};

const RANK: Record<DashboardAttentionSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export function AttentionCard({
  rows,
  className,
}: {
  rows: DashboardAttentionRow[];
  className?: string;
}) {
  /*
   * Money at risk decides the order, because that is how the reader would
   * rank these themselves. Rows with no figure fall back to severity, so a
   * credit breach never drops below a small unbilled total.
   */
  const sorted = [...rows].sort((a, b) => {
    const aPaise = a.valuePaise ? Number(a.valuePaise) : -1;
    const bPaise = b.valuePaise ? Number(b.valuePaise) : -1;
    if (aPaise !== bPaise) return bPaise - aPaise;
    return RANK[a.severity] - RANK[b.severity];
  });

  const atRisk = rows.reduce(
    (total, row) => total + (row.valuePaise ? Number(row.valuePaise) : 0),
    0,
  );

  return (
    <WidgetCard
      title="Needs attention"
      icon={IconAlertTriangle}
      meta={
        rows.length > 0 ? (
          <span className="flex items-center gap-2">
            {atRisk > 0 ? (
              <span
                className="font-medium tabular-nums text-foreground"
                title={`${exactMoney(atRisk)} at risk`}
              >
                {shortMoney(atRisk)} at risk
              </span>
            ) : null}
            <span className="rounded-sm bg-destructive/10 px-1.5 font-medium tabular-nums text-destructive">
              {rows.length} {rows.length === 1 ? "item" : "items"}
            </span>
          </span>
        ) : undefined
      }
      className={className}
      bodyClassName={rows.length === 0 ? "" : "p-0"}
    >
      {rows.length === 0 ? (
        <p className="flex flex-col items-center justify-center gap-1.5 py-6 text-center text-sm text-muted-foreground">
          <IconCircleCheck className="size-5 text-success" aria-hidden="true" />
          Nothing is slipping — every rule is clear.
        </p>
      ) : (
        <ul className="divide-y">
          {sorted.map((row) => (
            <li key={row.key}>
              <Link
                href={ATTENTION_ROUTES[row.key]}
                className="flex items-stretch gap-3 transition-colors duration-150 hover:bg-muted/50"
              >
                <span
                  className={cn("w-1 shrink-0", STRIPE[row.severity])}
                  aria-hidden="true"
                />
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 py-3 pr-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">
                      {row.title}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {row.detail}
                    </span>
                  </span>
                  {row.valuePaise ? (
                    <span
                      className="shrink-0 text-right"
                      title={exactMoney(Number(row.valuePaise))}
                    >
                      <span className="block text-sm font-semibold tabular-nums text-foreground">
                        {shortMoney(Number(row.valuePaise))}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        at risk
                      </span>
                    </span>
                  ) : (
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                      {row.value}
                    </span>
                  )}
                  <IconChevronRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}
