"use client";

import * as React from "react";
import Link from "next/link";
import type { DashboardGlance, DashboardRevenue } from "@skerp/types";
import { cn } from "@/lib/utils";
import { count, deltaLabel, exactMoney, shortMoneyParts } from "./format";
import { DASHBOARD_ROUTES } from "../routes";

/**
 * The four money figures, as compact cards rather than one dense cluster.
 *
 * They run on two different clocks and the card says which: Revenue and
 * Collections are the selected period, Outstanding and Overdue are live totals
 * over every open bill and ignore the period entirely. Without the chip the
 * four read as one timeframe, which they are not.
 */
export function MoneyCards({
  revenue,
  glance,
  periodLabel,
  previousLabel,
}: {
  revenue: DashboardRevenue | null;
  glance: DashboardGlance | null;
  periodLabel: string;
  previousLabel: string;
}) {
  const cards: React.ReactNode[] = [];

  if (revenue) {
    const delta = deltaLabel(revenue.deltaPct);
    cards.push(
      <MoneyCard
        key="revenue"
        label="Revenue billed"
        when={periodLabel}
        paise={revenue.totalPaise}
        href={DASHBOARD_ROUTES.revenue}
        foot={
          <>
            {delta ? (
              <span
                className={cn(
                  "font-medium",
                  revenue.deltaPct !== null && revenue.deltaPct >= 0
                    ? "text-success"
                    : "text-destructive",
                )}
                title={`Against ${previousLabel}`}
              >
                {delta}
              </span>
            ) : null}
            <span>{count(revenue.billCount)} bills</span>
          </>
        }
      />,
    );
  }

  if (glance?.collectedPaise !== null && glance?.collectedPaise !== undefined) {
    const billed = revenue?.totalPaise ?? 0;
    cards.push(
      <MoneyCard
        key="collected"
        label="Collections"
        when={periodLabel}
        paise={glance.collectedPaise}
        href={DASHBOARD_ROUTES.receipts}
        foot={
          billed > 0 ? (
            <span title="Received this period against what was billed this period. A receipt can settle an older bill, so this is not a completion rate.">
              {Math.round((glance.collectedPaise / billed) * 100)}% of billed
            </span>
          ) : null
        }
      />,
    );
  }

  if (
    glance?.outstandingPaise !== null &&
    glance?.outstandingPaise !== undefined
  ) {
    cards.push(
      <MoneyCard
        key="outstanding"
        label="Outstanding"
        when="As of today"
        paise={glance.outstandingPaise}
        href={DASHBOARD_ROUTES.ageing}
        foot={<span>Across every open bill</span>}
      />,
    );
  }

  if (glance?.overduePaise !== null && glance?.overduePaise !== undefined) {
    cards.push(
      <MoneyCard
        key="overdue"
        label="Overdue"
        when="As of today"
        paise={glance.overduePaise}
        href={DASHBOARD_ROUTES.ageing}
        tone="destructive"
        foot={
          <span>
            {count(glance.overdueCount ?? 0)} bills past their due date
          </span>
        }
      />,
    );
  }

  if (cards.length === 0) return null;

  // No wrapper: the tiles are laid out by the page's mosaic, four across at
  // xl and two on anything narrower.
  return <>{cards}</>;
}

/** One row unit tall, a quarter of the grid wide. */
const TILE_SPAN = "col-span-1";

function MoneyCard({
  label,
  when,
  paise,
  foot,
  href,
  tone = "default",
}: {
  label: string;
  when: string;
  paise: number;
  foot?: React.ReactNode;
  href?: string;
  tone?: "default" | "destructive";
}) {
  const { value, unit } = shortMoneyParts(paise);

  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          {when}
        </span>
      </div>
      <p
        className={cn(
          "mt-1.5 text-2xl font-semibold tabular-nums tracking-tight",
          tone === "destructive" && "text-destructive",
        )}
        title={exactMoney(paise)}
      >
        ₹{value}
        <span className="ml-0.5 text-base font-medium">{unit}</span>
      </p>
      {foot ? (
        <p className="mt-1 flex items-center gap-x-2 truncate text-xs text-muted-foreground">
          {foot}
        </p>
      ) : null}
    </>
  );

  const shell = cn(
    TILE_SPAN,
    "flex min-w-0 flex-col justify-center rounded-lg border bg-card px-4 py-3 transition-colors duration-150",
    tone === "destructive" && "border-destructive/35",
    href && "hover:bg-muted/40",
  );

  return href ? (
    <Link href={href} className={shell} aria-label={`${label}, ${when}`}>
      {body}
    </Link>
  ) : (
    <section aria-label={label} className={shell}>
      {body}
    </section>
  );
}
