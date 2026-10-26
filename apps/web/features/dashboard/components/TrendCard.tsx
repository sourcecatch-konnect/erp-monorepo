"use client";

import { IconTrendingUp } from "@tabler/icons-react";
import type { DashboardMonthPoint } from "@skerp/types";
import { WidgetCard, WidgetEmpty } from "./WidgetCard";
import { exactMoney, shortMoney } from "./format";
import { DASHBOARD_ROUTES } from "../routes";

/**
 * Billed against collected, twelve months.
 *
 * Two lines rather than twenty-four bars: the question the card answers is
 * whether the GAP is widening, which is a trend, and a trend reads better as a
 * line. The gap itself is the point — a bill raised in March can be settled in
 * June, so collected is not a share of billed and the two are never stacked.
 *
 * The series always covers twelve months and ignores the page's period
 * selector, which the subtitle says outright; the current month is drawn
 * dashed because it is still filling.
 */
export function TrendCard({
  series,
  className,
}: {
  series: DashboardMonthPoint[];
  className?: string;
}) {
  const hasCollected = series.some((p) => p.collectedPaise !== null);
  const peak = Math.max(
    1,
    ...series.map((p) => Math.max(p.valuePaise, p.collectedPaise ?? 0)),
  );
  const everything = series.reduce(
    (n, p) => n + p.valuePaise + (p.collectedPaise ?? 0),
    0,
  );

  // viewBox units; the card scales it to whatever width it gets.
  const W = 300;
  const H = 100;
  const x = (i: number) =>
    series.length > 1 ? (i / (series.length - 1)) * W : W / 2;
  const y = (paise: number) => H - (paise / peak) * (H - 8);

  const path = (pick: (p: DashboardMonthPoint) => number, upto: number) =>
    series
      .slice(0, upto)
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(pick(p)).toFixed(1)}`)
      .join(" ");

  // The last point is the month in progress: solid up to it, dashed into it.
  const settled = series.length - 1;
  const tail = (pick: (p: DashboardMonthPoint) => number) =>
    series.length < 2
      ? ""
      : `M${x(settled - 1).toFixed(1)},${y(pick(series[settled - 1]!)).toFixed(1)} L${x(settled).toFixed(1)},${y(pick(series[settled]!)).toFixed(1)}`;

  const billed = (p: DashboardMonthPoint) => p.valuePaise;
  const collected = (p: DashboardMonthPoint) => p.collectedPaise ?? 0;

  // "12 months" left the axis unreadable: the single-letter labels repeat (two
  // J's, two M's) and nothing said the first ones belong to last year, so the
  // chart looked like it began in November for no reason. Naming the window
  // answers that before anyone has to work it out from the letters.
  const span = monthRange(series);

  return (
    <WidgetCard
      title="Billed vs collected"
      icon={IconTrendingUp}
      meta={
        <span title="Always the last 12 months, whatever period is selected above.">
          {span}
        </span>
      }
      href={DASHBOARD_ROUTES.revenue}
      className={className}
      bodyClassName="flex min-h-0 flex-col gap-2"
    >
      {everything === 0 ? (
        <WidgetEmpty>Nothing billed or received in the last year.</WidgetEmpty>
      ) : (
        <>
          {/* The scale sits over the plot rather than in a left gutter: at
              this card width the gutter clipped its own label as soon as the
              peak needed more than three characters. */}
          <div className="relative flex min-w-0 flex-col">
            <span className="pointer-events-none absolute right-0 top-0 z-10 bg-card/80 pl-1 text-xs tabular-nums text-muted-foreground">
              peak {shortMoney(peak)}
            </span>
            <div className="min-w-0 flex-1">
              <svg
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="none"
                className="h-24 w-full border-b"
                role="img"
                aria-label={`Billed and collected per month for the last twelve months. Latest month billed ${shortMoney(series.at(-1)?.valuePaise ?? 0)}.`}
              >
                {hasCollected ? (
                  <>
                    <path
                      d={path(collected, series.length - 1)}
                      fill="none"
                      stroke="var(--primary)"
                      strokeOpacity="0.45"
                      strokeWidth="2"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                    <path
                      d={tail(collected)}
                      fill="none"
                      stroke="var(--primary)"
                      strokeOpacity="0.45"
                      strokeWidth="2"
                      strokeDasharray="4 3"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </>
                ) : null}
                <path
                  d={path(billed, series.length - 1)}
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={tail(billed)}
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              <div className="mt-1 flex">
                {series.map((point, i) => (
                  <span
                    key={point.month}
                    title={`${point.month}: billed ${exactMoney(point.valuePaise)}${
                      point.collectedPaise !== null
                        ? `, collected ${exactMoney(point.collectedPaise)}`
                        : ""
                    }`}
                    className={
                      i === series.length - 1
                        ? "flex-1 text-center text-xs font-medium text-foreground"
                        : "flex-1 text-center text-xs text-muted-foreground"
                    }
                  >
                    {point.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t pt-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-3.5 bg-primary" aria-hidden="true" />
              Billed
            </span>
            {hasCollected ? (
              <span
                className="inline-flex items-center gap-1.5"
                title="Receipts in that month. A receipt can settle an older bill, so this is not a share of the line above it — the gap between them is money invoiced and not yet in."
              >
                <span
                  className="h-0.5 w-3.5 bg-primary opacity-45"
                  aria-hidden="true"
                />
                Collected
              </span>
            ) : null}
            <span>Dashed = month in progress</span>
          </div>
        </>
      )}
    </WidgetCard>
  );
}

/** "Nov 2025 – Oct 2026" from the series' own YYYY-MM keys. */
function monthRange(series: DashboardMonthPoint[]): string {
  const first = series[0]?.month;
  const last = series.at(-1)?.month;
  if (!first || !last) return "12 months";
  return `${pretty(first)} – ${pretty(last)}`;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function pretty(key: string): string {
  const [year, month] = key.split("-");
  const name = MONTHS[Number(month) - 1];
  return name && year ? `${name} ${year}` : key;
}
