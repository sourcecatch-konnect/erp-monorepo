// apps/web/features/MRRR/mrrr-ui.tsx

import type { MRRR } from "@skerp/types";
import { cn } from "@/lib/utils";
import { formatPaise } from "@/lib/money";

export type MRRRStatus = MRRR["status"];

const STATUS_LABELS: Record<MRRRStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  CANCELLED: "Cancelled",
};

const STATUS_STYLES: Record<MRRRStatus, string> = {
  DRAFT: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  SUBMITTED: "bg-green-500/10 text-green-700 border-green-500/20",
  CANCELLED: "bg-red-500/10 text-red-700 border-red-500/20",
};

const isMRRRStatus = (
  status: string | null | undefined,
): status is MRRRStatus => {
  return status === "DRAFT" || status === "SUBMITTED" || status === "CANCELLED";
};

export function MRRRStatusBadge({ status }: { status?: string | null }) {
  if (!isMRRRStatus(status)) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-md border px-2.5 py-1",
          "text-xs font-semibold shadow-sm",
          "bg-muted text-muted-foreground border-border",
        )}
      >
        <span className="h-2 w-2 rounded-full bg-current shadow-[0_0_0_3px_currentColor]/10" />
        —
      </span>
    );
  }

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

export const MRRR_STATUS_ORDER: {
  key: "ALL" | MRRRStatus;
  label: string;
}[] = [
    { key: "ALL", label: "All" },
    { key: "DRAFT", label: "Draft" },
    { key: "SUBMITTED", label: "Submitted" },
    { key: "CANCELLED", label: "Cancelled" },
  ];

export const formatMRRRDate = (date?: string | Date | null) => {
  if (!date) return "—";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const formatMRRRDateTime = (date?: string | Date | null) => {
  if (!date) return "—";

  return new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
export const formatFreight = (
  value: string | number | bigint | null | undefined,
) => {
  if (value === null || value === undefined || value === "") return "—";

  const amount = Number(value);

  if (Number.isNaN(amount)) return "—";

  return formatPaise(amount);
};
