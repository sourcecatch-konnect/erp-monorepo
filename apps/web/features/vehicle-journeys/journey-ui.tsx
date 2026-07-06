import * as React from "react";
import type {
  VehicleJourneyStatus,
  JourneySettlementStatus,
  TripLegType,
  TripStatus,
  TripType,
  TripExpenseStatus,
  TripExpenseType,
} from "@skerp/types";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Journey status                                                     */
/* ------------------------------------------------------------------ */

const JOURNEY_STATUS_LABELS: Record<VehicleJourneyStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  RETURNED: "Returned",
  READY_FOR_LOGSLIP: "Ready for Log Slip",
  SETTLED: "Settled",
  REOPENED: "Reopened",
  CANCELLED: "Cancelled",
};

const JOURNEY_STATUS_STYLES: Record<VehicleJourneyStatus, string> = {
  DRAFT: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  ACTIVE: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  RETURNED: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  READY_FOR_LOGSLIP: "bg-violet-500/10 text-violet-700 border-violet-500/20",
  SETTLED: "bg-green-500/10 text-green-700 border-green-500/20",
  REOPENED: "bg-orange-500/10 text-orange-700 border-orange-500/20",
  CANCELLED: "bg-slate-500/10 text-slate-600 border-slate-500/20",
};

export function JourneyStatusBadge({
  status,
}: {
  status: VehicleJourneyStatus;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-2.5 py-1",
        "text-xs font-semibold whitespace-nowrap",
        JOURNEY_STATUS_STYLES[status],
      )}
    >
      <span className="h-2 w-2 rounded-full bg-current" />
      {JOURNEY_STATUS_LABELS[status]}
    </span>
  );
}

export const JOURNEY_STATUS_ORDER: { key: string; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "RETURNED", label: "Returned" },
  { key: "READY_FOR_LOGSLIP", label: "Ready for Log Slip" },
  { key: "SETTLED", label: "Settled" },
  { key: "CANCELLED", label: "Cancelled" },
];

/* ------------------------------------------------------------------ */
/* Settlement status                                                  */
/* ------------------------------------------------------------------ */

export const SETTLEMENT_LABELS: Record<JourneySettlementStatus, string> = {
  NOT_READY: "Not ready",
  PENDING_REVIEW: "Pending review",
  READY: "Ready",
  GENERATED: "Log slip generated",
  POSTED: "Posted",
  TALLY_SYNCED: "Tally synced",
};

/* ------------------------------------------------------------------ */
/* Leg status / type                                                  */
/* ------------------------------------------------------------------ */

const LEG_STATUS_LABELS: Record<TripStatus, string> = {
  Planned: "Planned",
  InTransit: "In Transit",
  Closed: "Closed",
  Cancelled: "Cancelled",
};

const LEG_STATUS_STYLES: Record<TripStatus, string> = {
  Planned: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  InTransit: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  Closed: "bg-green-500/10 text-green-700 border-green-500/20",
  Cancelled: "bg-slate-500/10 text-slate-600 border-slate-500/20",
};

export function LegStatusBadge({ status }: { status: TripStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        LEG_STATUS_STYLES[status],
      )}
    >
      {LEG_STATUS_LABELS[status]}
    </span>
  );
}

export const LEG_TYPE_LABELS: Record<TripLegType, string> = {
  LR: "LR",
  DC: "Rake (DC)",
  EMPTY: "Empty",
  LOCAL: "Local",
  RETURN: "Return",
  WORKSHOP: "Workshop",
  OTHER: "Other",
};

type LegDispatchGateInput = {
  status: TripStatus;
  tripType: TripType;
  isTripEmpty: boolean;
};

/**
 * LR legs carrying goods dispatch by attaching an LR (server flips them to
 * InTransit on attach) — DC/empty legs have no LR to attach, so they use the
 * direct dispatch action instead. See `legDispatchesDirect`. Mirrors
 * `tripAttachesLR` / `tripDispatchesDirect` in features/trips/trip-ui.tsx.
 */
export function legAttachesLR(leg: LegDispatchGateInput): boolean {
  return (
    leg.status === "Planned" && leg.tripType === "lr" && !leg.isTripEmpty
  );
}

export function legDispatchesDirect(leg: LegDispatchGateInput): boolean {
  return (
    leg.status === "Planned" && (leg.tripType === "dc" || leg.isTripEmpty)
  );
}

/* ------------------------------------------------------------------ */
/* Expense                                                            */
/* ------------------------------------------------------------------ */

export const EXPENSE_TYPE_LABELS: Record<TripExpenseType, string> = {
  DIESEL: "Diesel",
  TOLL: "Toll",
  PARKING: "Parking",
  FOOD: "Food",
  REPAIR: "Repair",
  FINE: "Fine",
  LOADING: "Loading",
  UNLOADING: "Unloading",
  MISC: "Miscellaneous",
};

const EXPENSE_STATUS_STYLES: Record<TripExpenseStatus, string> = {
  DRAFT: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  APPROVED: "bg-green-500/10 text-green-700 border-green-500/20",
  REJECTED: "bg-red-500/10 text-red-700 border-red-500/20",
  POSTED: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  REVERSED: "bg-slate-500/10 text-slate-600 border-slate-500/20",
};

export function ExpenseStatusBadge({ status }: { status: TripExpenseStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold",
        EXPENSE_STATUS_STYLES[status],
      )}
    >
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Formatting                                                         */
/* ------------------------------------------------------------------ */

export const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

export const formatDate = (value: string | null | undefined) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};
