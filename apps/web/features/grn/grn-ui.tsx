import * as React from "react";
import type { GRNStatus } from "@skerp/types";
import { cn } from "@/lib/utils";
import { formatPaise } from "@/lib/money";

export { formatDate, formatDateTime } from "@/lib/format";

const STATUS_LABELS: Record<GRNStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  CANCELLED: "Cancelled",
};

const STATUS_STYLES: Record<GRNStatus, string> = {
  DRAFT: "border-amber-500/20 bg-amber-500/10 text-amber-700",
  SUBMITTED: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
  CANCELLED: "border-slate-500/20 bg-slate-500/10 text-slate-600",
};

export const GRN_STATUS_TABS: { key: "ALL" | GRNStatus; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "SUBMITTED", label: "Submitted" },
  { key: "CANCELLED", label: "Cancelled" },
];

export function GRNStatusBadge({ status }: { status: GRNStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-semibold",
        STATUS_STYLES[status],
      )}
    >
      <span className="size-2 rounded-full bg-current" />
      {STATUS_LABELS[status]}
    </span>
  );
}

export const formatGRNMoney = (
  value: string | number | null | undefined,
) => {
  if (value === null || value === undefined || value === "") return "-";

  const amount = typeof value === "string" ? Number(value) : value;

  if (Number.isNaN(amount)) return "-";

  return formatPaise(amount);
};
