"use client";

import Link from "next/link";
import { IconRouteSquare } from "@tabler/icons-react";
import type { DashboardGlance, DashboardOperations } from "@skerp/types";
import { WidgetCard } from "./WidgetCard";
import { count } from "./format";
import { FUNNEL_ROUTES } from "../routes";

/**
 * Operations — is freight moving, and what is standing still right now.
 *
 * Two blocks with their own headings, because they answer on different
 * clocks: the cohort is activity inside the selected period, the figures below
 * it are the state of the business at this moment. Mixing them under one title
 * was what made the old funnel card read as a single story.
 *
 * Orders sits apart from the bars on purpose. It counts orders by their own
 * date while the bars count LRs by theirs, so the step between them is not a
 * drop-off and must not be drawn as one.
 */
export function OperationsCard({
  data,
  glance,
  periodLabel,
  className,
}: {
  data: DashboardOperations;
  glance: DashboardGlance | null;
  periodLabel: string;
  className?: string;
}) {
  const base = data.lrCreated;

  return (
    <WidgetCard
      title="Operations snapshot"
      icon={IconRouteSquare}
      className={className}
      bodyClassName="flex min-h-0 flex-col p-0"
    >
      <div className="border-b px-3.5 py-2.5">
        <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
          {periodLabel}
        </p>

        <div className="mb-2 flex items-baseline justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            Orders confirmed
          </span>
          <Link
            href={FUNNEL_ROUTES.orders}
            className="text-lg font-semibold tabular-nums text-foreground hover:text-primary"
          >
            {count(data.ordersConfirmed)}
          </Link>
        </div>

        <p className="mb-1.5 text-xs text-muted-foreground">
          Of{" "}
          <Link
            href={FUNNEL_ROUTES.lr}
            className="font-semibold text-foreground hover:text-primary"
          >
            {count(base)} LRs
          </Link>{" "}
          created {periodLabel.toLowerCase()}
        </p>

        {base === 0 ? (
          <p className="text-sm text-muted-foreground">
            No LRs raised in this window.
          </p>
        ) : (
          <ul className="space-y-1">
            {data.cohort.map((step) => (
              <li key={step.key} className="flex items-center gap-2">
                <span className="w-[5.5rem] shrink-0 text-xs text-muted-foreground">
                  {step.label}
                </span>
                <Link
                  href={FUNNEL_ROUTES[step.key]}
                  aria-label={`${step.label}: ${count(step.count)} of ${count(base)}`}
                  className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-sm bg-muted"
                >
                  <span
                    className="block h-full bg-primary"
                    style={{ width: `${(step.count / base) * 100}%` }}
                  />
                </Link>
                <span className="w-12 shrink-0 text-right text-xs font-medium tabular-nums">
                  {count(step.count)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {glance ? (
        <div className="px-3.5 py-2.5">
          <p className="mb-1.5 text-xs font-medium uppercase text-muted-foreground">
            As of today
          </p>
          {/* Three stats across rather than three stacked rows. The card has a
              fixed slot in the mosaic and WidgetCard clips, so this block has
              to cost one line, not three. */}
          <div className="flex items-start gap-3">
            {glance.tripsRunning !== null ? (
              <Stat
                label="Trips running"
                value={glance.tripsRunning}
                note="Company-wide — trips carry no branch"
              />
            ) : null}
            {glance.tripsClosingToday !== null ? (
              <Stat label="Closing today" value={glance.tripsClosingToday} />
            ) : null}
            {glance.billsPendingReview !== null ? (
              <Stat
                label="Pending review"
                value={glance.billsPendingReview}
                href="/accounts/bills"
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </WidgetCard>
  );
}

/** One figure in the "as of today" strip: number over label, one line tall. */
function Stat({
  label,
  value,
  note,
  href,
}: {
  label: string;
  value: number;
  /** Why this figure cannot be narrowed by the branch filter. */
  note?: string;
  href?: string;
}) {
  const number = (
    <span className="text-lg font-semibold leading-tight tabular-nums">
      {count(value)}
    </span>
  );
  return (
    <div className="min-w-0 flex-1" title={note}>
      {href ? (
        <Link
          href={href}
          className="text-foreground transition-colors duration-150 hover:text-primary"
        >
          {number}
        </Link>
      ) : (
        number
      )}
      <p className="truncate text-xs text-muted-foreground">
        {label}
        {note ? <span aria-hidden="true"> *</span> : null}
      </p>
    </div>
  );
}
