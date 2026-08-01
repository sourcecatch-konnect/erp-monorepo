import type { DeliveryChallanStatus } from "./delivery-challan.service";

import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<DeliveryChallanStatus, string> = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  CANCELLED: "Cancelled",
};

const STATUS_STYLES: Record<DeliveryChallanStatus, string> = {
  DRAFT: "border-slate-500/20 bg-slate-500/10 text-slate-600",
  ISSUED:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
  CANCELLED: "border-red-500/20 bg-red-500/10 text-red-700",
};

const isDeliveryChallanStatus = (
  status: string | null | undefined,
): status is DeliveryChallanStatus =>
  status === "DRAFT" ||
  status === "ISSUED" ||
  status === "CANCELLED";

export function DeliveryChallanStatusBadge({
  status,
  className,
}: {
  status?: string | null;
  className?: string;
}) {
  if (!isDeliveryChallanStatus(status)) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-md border px-2.5 py-1",
          "text-xs font-semibold shadow-sm",
          "border-border bg-muted text-muted-foreground",
          className,
        )}
      >
        <span className="size-2 rounded-full bg-current opacity-60" />
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
        className,
      )}
    >
      <span className="size-2 rounded-full bg-current" />
      {STATUS_LABELS[status]}
    </span>
  );
}

export const DELIVERY_CHALLAN_STATUS_ORDER: {
  key: "ALL" | DeliveryChallanStatus;
  label: string;
}[] = [
    { key: "ALL", label: "All" },
    { key: "DRAFT", label: "Draft" },
    { key: "ISSUED", label: "Issued" },
    { key: "CANCELLED", label: "Cancelled" },
  ];