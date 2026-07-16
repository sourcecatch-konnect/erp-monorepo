import * as React from "react";

import { cn } from "@/lib/utils";
export type GRNStatus = "DRAFT" | "SUBMITTED" | "CANCELLED";

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

export const GRN_STATUS_ORDER: { key: string; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "SUBMITTED", label: "Submitted" },
  { key: "CANCELLED", label: "Cancelled" },
];