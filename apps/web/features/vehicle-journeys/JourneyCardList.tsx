"use client";

import * as React from "react";
import Link from "next/link";
import type { JourneyLeg, VehicleJourney } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@skerp/ui/components/pagination";
import {
  IconChevronRight,
  IconDatabaseOff,
  IconExternalLink,
  IconFileInvoice,
  IconHome,
  IconSteeringWheel,
  IconTruck,
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import {
  JourneyStatusBadge,
  LegStatusBadge,
  JOURNEY_STATUS_ORDER,
  SETTLEMENT_LABELS,
  LEG_TYPE_LABELS,
  formatDateTime,
} from "./journey-ui";

type Props = {
  data: VehicleJourney[];
  total: number;
  page: number;
  size: number;
  onPageChange: (page: number) => void;
  onSizeChange: (size: number) => void;
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  counts: Record<string, number>;
  isLoading?: boolean;
};

/** "Jalgaon → Pune → Howrah" built from the journey's ordered legs. */
const routeChain = (j: VehicleJourney) => {
  const cities: string[] = [j.startCity?.name ?? "?"];
  for (const leg of j.trips ?? []) {
    if (leg.toCity?.name) cities.push(leg.toCity.name);
  }
  return cities.join(" → ");
};

const lastClosingKm = (j: VehicleJourney) => {
  const closed = (j.trips ?? []).filter((l) => l.closingKm !== null);
  const last = closed[closed.length - 1];
  return last?.closingKm ?? null;
};

/* ------------------------------------------------------------------ */
/* Vertical timeline (expanded card)                                  */
/* ------------------------------------------------------------------ */

const LEG_EDGE_STYLES: Record<string, string> = {
  Closed: "border-primary/50",
  InTransit: "border-blue-500/60 border-dashed",
  Planned: "border-muted-foreground/30 border-dashed",
};

function TimelineNode({
  city,
  isCurrent,
  isHome,
  caption,
}: {
  city: string;
  isCurrent: boolean;
  isHome: boolean;
  caption?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full border",
          isCurrent
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background text-muted-foreground",
        )}
      >
        {isCurrent ? (
          <IconTruck size={13} />
        ) : isHome ? (
          <IconHome size={12} />
        ) : (
          <span className="size-1.5 rounded-full bg-current" />
        )}
      </span>
      <span
        className={cn(
          "text-sm",
          isCurrent ? "font-semibold text-foreground" : "font-medium",
        )}
      >
        {city}
      </span>
      {isCurrent ? (
        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
          truck here
        </span>
      ) : null}
      {caption ? (
        <span className="text-xs text-muted-foreground">{caption}</span>
      ) : null}
    </div>
  );
}

function LegEdge({ leg }: { leg: JourneyLeg }) {
  return (
    <div
      className={cn(
        "ml-3 border-l-2 py-1.5 pl-5",
        LEG_EDGE_STYLES[leg.status] ?? "border-border",
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-muted-foreground">
          Leg {leg.sequenceNo}
        </span>
        <span className="text-muted-foreground">
          {leg.legType ? LEG_TYPE_LABELS[leg.legType] : "—"}
        </span>
        {leg.closingKm !== null ? (
          <span className="text-muted-foreground">
            KM {leg.closingKm.toLocaleString("en-IN")}
          </span>
        ) : null}
        <LegStatusBadge status={leg.status} />
      </div>
    </div>
  );
}

/**
 * Vertical city/leg timeline: a node per city, an edge per leg. The truck
 * icon marks the current city; a dashed tail shows the pending return to the
 * head-office base while the journey is still on the road.
 */
function JourneyCardTimeline({ journey }: { journey: VehicleJourney }) {
  const legs = journey.trips ?? [];
  const lastLeg = legs[legs.length - 1] ?? null;
  const atBase =
    lastLeg?.status === "Closed" &&
    lastLeg?.toCity?.id === journey.returnCityId;
  const showPendingReturn =
    journey.status === "ACTIVE" &&
    !atBase &&
    (legs.length === 0 || lastLeg?.toCity?.id !== journey.returnCityId);

  // The truck sits at the destination of the last closed leg (or the start).
  let currentIndex = 0;
  legs.forEach((leg, i) => {
    if (leg.status === "Closed") currentIndex = i + 1;
  });

  return (
    <div>
      <TimelineNode
        city={journey.startCity?.name ?? "?"}
        isCurrent={currentIndex === 0 && journey.status === "ACTIVE"}
        isHome={journey.startCityId === journey.returnCityId}
        caption={`started ${formatDateTime(journey.startedAt)}`}
      />
      {legs.map((leg, i) => (
        <React.Fragment key={leg.id}>
          <LegEdge leg={leg} />
          <TimelineNode
            city={leg.toCity?.name ?? "?"}
            isCurrent={
              currentIndex === i + 1 &&
              ["ACTIVE", "RETURNED", "READY_FOR_LOGSLIP"].includes(
                journey.status,
              ) &&
              leg.status === "Closed"
            }
            isHome={leg.toCity?.id === journey.returnCityId}
            caption={
              leg.status === "Closed" ? formatDateTime(leg.endDateTime) : undefined
            }
          />
        </React.Fragment>
      ))}
      {showPendingReturn ? (
        <>
          <div className="ml-3 border-l-2 border-dashed border-muted-foreground/30 py-1.5 pl-5">
            <span className="text-xs text-muted-foreground">
              return pending
            </span>
          </div>
          <div className="flex items-center gap-2.5 opacity-60">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-dashed text-muted-foreground">
              <IconHome size={12} />
            </span>
            <span className="text-sm text-muted-foreground">
              {journey.returnCity?.name ?? "?"} (base)
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Journey card                                                       */
/* ------------------------------------------------------------------ */

function JourneyCard({ journey }: { journey: VehicleJourney }) {
  const [open, setOpen] = React.useState(false);
  const legs = journey.trips ?? [];
  const closedLegs = legs.filter((l) => l.status === "Closed").length;
  const lastKm = lastClosingKm(journey);
  const progress = legs.length > 0 ? closedLegs / legs.length : 0;

  return (
    <div
      className={cn(
        "rounded-lg border bg-card transition-colors",
        open && "border-primary/40",
      )}
    >
      {/* Collapsed header — click anywhere to expand */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid w-full grid-cols-[auto_minmax(9rem,auto)_minmax(8rem,auto)_1fr_auto] items-center gap-x-4 gap-y-2 p-4 text-left transition-colors hover:bg-muted/30 max-md:grid-cols-[auto_1fr_auto]"
        aria-expanded={open}
      >
        <IconChevronRight
          size={16}
          className={cn(
            "shrink-0 text-muted-foreground transition-transform duration-150",
            open && "rotate-90",
          )}
        />

        <div>
          <span className="block text-sm font-semibold text-primary">
            {journey.journeyNumber}
          </span>
          <span className="block text-xs text-muted-foreground">
            {formatDateTime(journey.startedAt)}
          </span>
        </div>

        <div className="max-md:hidden">
          <span className="flex items-center gap-1 text-sm font-medium">
            <IconTruck size={14} className="text-muted-foreground" />
            {journey.vehicle?.vehicleNumber ?? "—"}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <IconSteeringWheel size={13} />
            {journey.driver?.name ?? "—"}
          </span>
        </div>

        <div className="min-w-0 max-md:hidden">
          <span className="block truncate text-sm">{routeChain(journey)}</span>
          <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className="h-1 w-16 overflow-hidden rounded-full bg-muted"
              aria-hidden
            >
              <span
                className="block h-full rounded-full bg-primary"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </span>
            {closedLegs}/{legs.length} leg{legs.length === 1 ? "" : "s"} closed
            · KM {journey.openingKm.toLocaleString("en-IN")}
            {lastKm !== null ? ` → ${lastKm.toLocaleString("en-IN")}` : ""}
          </span>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <JourneyStatusBadge status={journey.status} />
          <span className="text-xs text-muted-foreground">
            {SETTLEMENT_LABELS[journey.settlementStatus]}
          </span>
        </div>
      </button>

      {/* Expanded: timeline + actions */}
      {open ? (
        <div className="border-t px-4 py-4 md:pl-12">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <JourneyCardTimeline journey={journey} />
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {journey.logSlip ? (
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/vehicle-journeys/${journey.id}/log-slip`}>
                    <IconFileInvoice size={14} className="mr-1" />
                    {journey.logSlip.logSlipNumber ?? "Log slip"}
                  </Link>
                </Button>
              ) : null}
              <Button size="sm" asChild>
                <Link href={`/vehicle-journeys/${journey.id}`}>
                  <IconExternalLink size={14} className="mr-1" /> Open journey
                </Link>
              </Button>
            </div>
          </div>
          <div className="mt-3 text-xs text-muted-foreground md:hidden">
            {journey.vehicle?.vehicleNumber ?? "—"} ·{" "}
            {journey.driver?.name ?? "—"} · {closedLegs}/{legs.length} legs
            closed
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* List                                                               */
/* ------------------------------------------------------------------ */

export default function JourneyCardList(props: Props) {
  const {
    data,
    total,
    page,
    size,
    onPageChange,
    onSizeChange,
    search,
    onSearchChange,
    statusFilter,
    onStatusFilterChange,
    counts,
    isLoading,
  } = props;

  const pageCount = Math.max(1, Math.ceil(total / size));
  const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

  return (
    <div className="w-full space-y-3">
      {/* Status tabs */}
      <div className="flex flex-wrap items-center gap-1">
        {JOURNEY_STATUS_ORDER.map((tab) => {
          const active = statusFilter === tab.key;
          const count = counts[tab.key];
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onStatusFilterChange(tab.key)}
              className={`rounded-sm px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {tab.label}
              {typeof count === "number" ? (
                <span
                  className={`ml-1.5 rounded-sm px-1 text-xs ${
                    active
                      ? "bg-primary-foreground/20"
                      : "bg-muted-foreground/10"
                  }`}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="relative w-full sm:max-w-sm">
        <Input
          placeholder="Search journey no., vehicle or driver..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Journey cards */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="size-4 rounded-sm" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-6 w-20 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border bg-card py-14 text-muted-foreground">
          <div className="flex size-10 items-center justify-center rounded-full bg-muted">
            <IconDatabaseOff size={18} />
          </div>
          <span className="text-sm font-medium">No journeys found</span>
          <span className="text-xs">
            Journeys open automatically when a trip is created.
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((journey) => (
            <JourneyCard key={journey.id} journey={journey} />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 border-t px-1 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>
            {total === 0
              ? "Showing 0"
              : `Showing ${page * size + 1}-${Math.min((page + 1) * size, total)}`}{" "}
            of {total}
          </span>

          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <select
              value={size}
              onChange={(e) => onSizeChange(Number(e.target.value))}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <span>
            Page {page + 1} of {pageCount}
          </span>
        </div>

        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                aria-disabled={page === 0}
                className={page === 0 ? "pointer-events-none opacity-50" : ""}
                onClick={(e) => {
                  e.preventDefault();
                  if (page > 0) onPageChange(page - 1);
                }}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                aria-disabled={page + 1 >= pageCount}
                className={
                  page + 1 >= pageCount ? "pointer-events-none opacity-50" : ""
                }
                onClick={(e) => {
                  e.preventDefault();
                  if (page + 1 < pageCount) onPageChange(page + 1);
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
