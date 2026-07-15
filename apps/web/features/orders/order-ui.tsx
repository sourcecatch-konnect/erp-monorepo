import * as React from "react";
import type { OrderStatus } from "@skerp/types";
import {
  IconBan,
  IconChecks,
  IconCircleCheck,
  IconClock,
  IconFileText,
  IconList,
  IconTruckDelivery,
  IconX,
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import type { StatusTabDef } from "@/components/data-table";

// Date formatters — re-exported so existing order imports keep working.
// Money lives in `@/lib/money` (`formatRupees` / `formatPaise`).
export { formatDate, formatDateTime } from "@/lib/format";

const STATUS_LABELS: Record<OrderStatus, string> = {
  PendingApproval: "Pending Approval",
  Confirmed: "Confirmed",
  LRCreated: "LR Created",
  Rejected: "Rejected",
  Cancelled: "Cancelled",
  InProgress: "In Progress",
  Completed: "Completed",
};

const STATUS_STYLES: Record<OrderStatus, string> = {
  PendingApproval: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  Confirmed: "bg-green-500/10 text-green-700 border-green-500/20",
 LRCreated: "bg-violet-100 text-violet-700 border-violet-900",
  Rejected: "bg-red-500/10 text-red-700 border-red-500/20",
  Cancelled: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  InProgress: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  Completed: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1",
        "text-xs font-semibold shadow-sm",
        STATUS_STYLES[status],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_0_3px_currentColor]/10" />
      {STATUS_LABELS[status]}
    </span>
  );
}
export const STATUS_ORDER: StatusTabDef[] = [
  { key: "ALL", label: "All", icon: IconList },
  { key: "PendingApproval", label: "Pending Approval", icon: IconClock },
  { key: "Confirmed", label: "Confirmed", icon: IconCircleCheck },
  { key: "LRCreated", label: "LR Created", icon: IconFileText },
  { key: "Rejected", label: "Rejected", icon: IconX },
  { key: "Cancelled", label: "Cancelled", icon: IconBan },
  { key: "InProgress", label: "In Progress", icon: IconTruckDelivery },
  { key: "Completed", label: "Completed", icon: IconChecks },
];
