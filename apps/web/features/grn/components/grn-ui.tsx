import * as React from "react";

import { cn } from "@/lib/utils";
export type GRNStatus = "DRAFT" | "SUBMITTED" | "CANCELLED";
export type GRNVPLoadingStatus =
  | "PENDING"
  | "PARTIALLY_LOADED"
  | "FULLY_LOADED"
  | "CANCELLED";

const STATUS_LABELS: Record<GRNStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  CANCELLED: "Cancelled",
};

const STATUS_STYLES: Record<GRNStatus, string> = {
  DRAFT: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  SUBMITTED: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  CANCELLED: "bg-slate-500/10 text-slate-600 border-slate-500/20",
};

export function GRNStatusBadge({ status }: { status: GRNStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-2.5 py-1",
        "text-xs font-semibold shadow-sm",
        STATUS_STYLES[status],
      )}
    >
      <span className="h-2 w-2 rounded-full bg-current shadow-[0_0_0_3px_currentColor]/10" />
      {STATUS_LABELS[status]}
    </span>
  );
}

const VP_LOADING_LABELS: Record<GRNVPLoadingStatus, string> = {
  PENDING: "Pending Loading",
  PARTIALLY_LOADED: "Partially Loaded",
  FULLY_LOADED: "Fully Loaded",
  CANCELLED: "Loading Cancelled",
};

const VP_LOADING_STYLES: Record<GRNVPLoadingStatus, string> = {
  PENDING: "border-slate-500/20 bg-slate-500/10 text-slate-600",
  PARTIALLY_LOADED: "border-orange-500/20 bg-orange-500/10 text-orange-700",
  FULLY_LOADED: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
  CANCELLED: "border-red-500/20 bg-red-500/10 text-red-700",
};

export function GRNVPLoadingStatusBadge({
  status,
}: {
  status: GRNVPLoadingStatus;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold",
        VP_LOADING_STYLES[status],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {VP_LOADING_LABELS[status]}
    </span>
  );
}

export const GRN_STATUS_ORDER: { key: string; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "SUBMITTED", label: "Submitted" },
  { key: "CANCELLED", label: "Cancelled" },
];
