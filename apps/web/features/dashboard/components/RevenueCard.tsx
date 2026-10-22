"use client";

import { IconTrendingUp } from "@tabler/icons-react";
import type { DashboardRevenue } from "@skerp/types";
import { DeltaChip, WidgetCard } from "./WidgetCard";
import { count, deltaLabel, exactMoney, shortMoneyParts } from "./format";
import { DASHBOARD_ROUTES } from "../routes";

/**
 * The hero: revenue billed in the period, over the last twelve months. It is
 * the one card on the page carrying visual weight — the figure is the largest
 * type on the screen and the trend bleeds to the card's edges.
 */
export function RevenueCard({
  data,
  periodLabel,
  previousLabel,
  className,
}: {
  data: DashboardRevenue;
  periodLabel: string;
  previousLabel: string;
  className?: string;
}) {
  const { value, unit } = shortMoneyParts(data.totalPaise);
  const delta = deltaLabel(data.deltaPct);

  return (
    <WidgetCard
      title="Revenue billed"
      icon={IconTrendingUp}
      meta={periodLabel}
      href={DASHBOARD_ROUTES.revenue}
      className={className}
      bodyClassName="flex flex-col justify-between pb-0"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {data.billCount > 0
              ? `${count(data.billCount)} ${data.billCount === 1 ? "bill" : "bills"} raised`
              : "No bills raised yet"}
          </p>
          <p
            className="mt-0.5 text-xl font-semibold tracking-tight tabular-nums text-foreground"
            title={exactMoney(data.totalPaise)}
          >
            ₹{value}
            {unit ? (
              <span className="ml-1 text-sm font-medium text-muted-foreground">
                {unit}
              </span>
            ) : null}
          </p>
        </div>
        {delta && data.deltaPct !== null ? (
          <DeltaChip
            label={delta}
            pct={data.deltaPct}
            title={`${exactMoney(data.previousPaise)} ${previousLabel}`}
          />
        ) : (
          <span className="text-xs text-muted-foreground">
            no {previousLabel} figure
          </span>
        )}
      </div>
      <Sparkline series={data.series} />
    </WidgetCard>
  );
}

const CHART_W = 304;
const CHART_H = 76;
const PAD = 6;

/**
 * Twelve months as an area, drawn to one scale from zero so the heights are
 * comparable. Decorative — the figures it summarises are in the card above and
 * on the ageing and customer cards, so it carries no labels of its own.
 */
function Sparkline({ series }: { series: DashboardRevenue["series"] }) {
  const values = series.map((p) => p.valuePaise);
  const max = Math.max(...values, 1);
  const step = series.length > 1 ? (CHART_W - 4) / (series.length - 1) : 0;

  const points = values.map((v, i) => {
    const x = 2 + i * step;
    const y = CHART_H - PAD - (v / max) * (CHART_H - PAD * 2);
    return { x, y };
  });

  if (points.length === 0) return <div className="h-[76px]" />;

  const line = points
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" L");
  const last = points[points.length - 1]!;

  return (
    <div className="-mx-3.5 -mb-3.5 mt-2 h-[76px]" aria-hidden="true">
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        preserveAspectRatio="none"
        className="block size-full"
      >
        <defs>
          <linearGradient id="dash-revenue-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          fill="url(#dash-revenue-fill)"
          d={`M${line} L${last.x.toFixed(1)},${CHART_H} L2,${CHART_H} Z`}
        />
        <path
          fill="none"
          stroke="var(--primary)"
          strokeWidth="1.75"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          d={`M${line}`}
        />
        <circle
          cx={last.x}
          cy={last.y}
          r="2.5"
          fill="var(--primary)"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
