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
  branchFiltered = false,
  className,
}: {
  data: DashboardFleet;
  /** The page is narrowed to one branch, but vehicles are not branch data. */
  branchFiltered?: boolean;
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
      meta={
        data.total > 0
          ? `${count(data.total)} trucks${branchFiltered ? " · all branches" : ""}`
          : undefined
      }
      href={DASHBOARD_ROUTES.fleet}
      className={className}


    >
      {data.total === 0 ? (
        <WidgetEmpty>No own vehicles on the master yet.</WidgetEmpty>
      ) : (
        <div className="flex w-full flex-wrap items-center gap-5">
          {/* Fleet utilisation */}
          <div
            className="relative size-32 shrink-0"
            role="img"
            aria-label={`${data.utilisationPct}% on trip. ${count(data.running)} running, ${count(data.idle)} idle, ${count(data.workshop)} in workshop.`}
          >
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
                strokeWidth="10"
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
                    strokeWidth="10"
                    strokeDasharray={`${arc.length} ${CIRCUMFERENCE - arc.length}`}
                    strokeDashoffset={-arc.offset}
                  />
                ) : null,
              )}
            </svg>

            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-1"
              aria-hidden="true"
            >
              <span className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">
                {data.utilisationPct}%
              </span>
              <span className="text-xs text-muted-foreground">
                On trip
              </span>
            </div>
          </div>

          {/* Fleet breakdown */}
          <ul className="min-w-32 flex-1 space-y-3">
            {arcs.map((arc) => (
              <li
                key={arc.key}
                className="flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: arc.color }}
                    aria-hidden="true"
                  />
                  <span className="text-sm capitalize text-muted-foreground">
                    {arc.label}
                  </span>
                </div>

                <span className="text-lg font-semibold tabular-nums">
                  {count(arc.value)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </WidgetCard>
  );

}
