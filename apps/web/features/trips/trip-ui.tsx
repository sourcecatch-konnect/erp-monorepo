import * as React from "react";
import type { Trip, TripStatus, TripType } from "@skerp/types";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<TripStatus, string> = {
  Planned: "Planned",
  InTransit: "In Transit",
  Closed: "Closed",
  Cancelled: "Cancelled",
};

const STATUS_STYLES: Record<TripStatus, string> = {
  Planned: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  InTransit: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  Closed: "bg-green-500/10 text-green-700 border-green-500/20",
  Cancelled: "bg-slate-500/10 text-slate-600 border-slate-500/20",
};

export function TripStatusBadge({ status }: { status: TripStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-2.5 py-1",
        "text-xs font-semibold shadow-sm",
        STATUS_STYLES[status]
      )}
    >
      <span className="h-2 w-2 rounded-full bg-current shadow-[0_0_0_3px_currentColor]/10" />
      {STATUS_LABELS[status]}
    </span>
  );
}

export const TRIP_TYPE_LABELS: Record<TripType, string> = {
  lr: "LR",
  dc: "Rake (DC)",
};

export const TRIP_STATUS_ORDER: { key: string; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "Planned", label: "Planned" },
  { key: "InTransit", label: "In Transit" },
  { key: "Closed", label: "Closed" },
  { key: "Cancelled", label: "Cancelled" },
];

type DispatchGateInput = Pick<Trip, "status" | "tripType" | "isTripEmpty">;

/**
 * LR trips carrying goods dispatch by attaching an LR (server flips them to
 * InTransit on attach) — DC/empty legs have no LR to attach, so they use the
 * direct dispatch action instead. See `tripDispatchesDirect`.
 */
export function tripAttachesLR(trip: DispatchGateInput): boolean {
  return (
    trip.status === "Planned" && trip.tripType === "lr" && !trip.isTripEmpty
  );
}

export function tripDispatchesDirect(trip: DispatchGateInput): boolean {
  return (
    trip.status === "Planned" && (trip.tripType === "dc" || trip.isTripEmpty)
  );
}
