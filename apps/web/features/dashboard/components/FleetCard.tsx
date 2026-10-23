"use client";

import { IconTruck } from "@tabler/icons-react";
import type { DashboardFleet } from "@skerp/types";
import { WidgetCard, WidgetEmpty } from "./WidgetCard";
import { count } from "./format";
import { DASHBOARD_ROUTES } from "../routes";

const R = 40;
const CIRCUMFERENCE = 2 * Math.PI * R;
/** Blank left between segments, in the same units as the dash array. */
const GAP = 2;

const SEGMENTS = [
  { key: "running", label: "running", color: "var(--primary)" },
  {
    key: "idle",
    label: "idle",
    color: "color-mix(in oklab, var(--muted-foreground) 45%, transparent)",
  },
  { key: "workshop", label: "workshop", color: "var(--warning)" },
] as const;

/**
 * Own fleet, split three ways. A truck on an open job card counts as workshop
 * even while `Vehicle.status` still says ON_TRIP — `Vehicle.status` only
 * distinguishes AVAILABLE from ON_TRIP, so the workshop count is derived and
 * takes precedence (the server does this; see dashboard/widgets.ts).
 */
export function FleetCard({
  data,
  className,
}: {
  data: DashboardFleet;
  className?: string;
}) {
  const counts: Record<(typeof SEGMENTS)[number]["key"], number> = {
    running: data.running,
    idle: data.idle,
    workshop: data.workshop,
  };

  let offset = 0;
  const arcs = SEGMENTS.map((segment) => {
    const value = counts[segment.key];
    const length = data.total > 0 ? (value / data.total) * CIRCUMFERENCE : 0;
    const arc = {
      ...segment,
      value,
      length: Math.max(length - GAP, 0),
      offset,
    };
    offset += length;
    return arc;
  });

  return (
    <WidgetCard
      title="Own fleet"
      icon={IconTruck}
      meta={data.total > 0 ? `${count(data.total)} trucks` : undefined}
      href={DASHBOARD_ROUTES.fleet}
      className={className}
      bodyClassName="flex items-center gap-4"
    >
      {data.total === 0 ? (
        <WidgetEmpty>No own vehicles on the master yet.</WidgetEmpty>
      ) : (
        <>
          <div className="relative size-24 shrink-0">
            <svg
              viewBox="0 0 100 100"
              className="size-full -rotate-90"
              aria-hidden="true"
            >
              <circle
                cx="50"
                cy="50"
                r={R}
                fill="none"
                stroke="var(--muted)"
                strokeWidth="11"
              />
              {arcs.map((arc) =>
                arc.length > 0 ? (
                  <circle
                    key={arc.key}
                    cx="50"
                    cy="50"
                    r={R}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth="11"
                    strokeDasharray={`${arc.length} ${CIRCUMFERENCE - arc.length}`}
                    strokeDashoffset={-arc.offset}
                  />
                ) : null,
              )}
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-semibold tabular-nums text-foreground">
                {data.utilisationPct}%
              </span>
              <span className="text-xs text-muted-foreground">on trip</span>
            </span>
          </div>
          <ul className="flex min-w-0 flex-col gap-2">
            {arcs.map((arc) => (
              <li key={arc.key} className="flex items-center gap-2 text-sm">
                <span
                  className="size-2 shrink-0 rounded-sm"
                  style={{ background: arc.color }}
                  aria-hidden="true"
                />
                <span className="font-medium tabular-nums text-foreground">
                  {count(arc.value)}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {arc.label}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </WidgetCard>
  );
}
