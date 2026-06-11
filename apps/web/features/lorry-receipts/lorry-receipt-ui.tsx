import * as React from "react";
import type { LRStatus, LRSource } from "@skerp/types";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<LRStatus, string> = {
  DRAFT: "Draft",
  FINALISED: "Finalised",
  CANCELLED: "Cancelled",
};

const STATUS_STYLES: Record<LRStatus, string> = {
  DRAFT: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  FINALISED: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  CANCELLED: "bg-slate-500/10 text-slate-600 border-slate-500/20",
};

export function LRStatusBadge({ status }: { status: LRStatus }) {
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

export const SOURCE_LABELS: Record<LRSource, string> = {
  FROM_ORDER: "From Order",
  INSTANT: "Instant",
};

export const LR_STATUS_ORDER: { key: string; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "FINALISED", label: "Finalised" },
  { key: "CANCELLED", label: "Cancelled" },
];
