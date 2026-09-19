import { StatusPill, type StatusPillTone } from "@/features/masters/_shared/StatusPill";
import type { PurchaseOrderStatus } from "./api/purchase-order.service";

const STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  DRAFT: "Draft",
  APPROVED: "Approved",
  SENT: "Sent",
  PARTIALLY_RECEIVED: "Partially received",
  RECEIVED: "Received",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

const STATUS_TONE: Record<PurchaseOrderStatus, StatusPillTone> = {
  DRAFT: "slate",
  APPROVED: "blue",
  SENT: "sky",
  PARTIALLY_RECEIVED: "amber",
  RECEIVED: "emerald",
  CLOSED: "violet",
  CANCELLED: "rose",
};

type PurchaseOrderStatusBadgeProps = {
  status: PurchaseOrderStatus;
  className?: string;
};

export function PurchaseOrderStatusBadge({
  status,
  className,
}: PurchaseOrderStatusBadgeProps) {
  return <StatusPill tone={STATUS_TONE[status]} label={STATUS_LABELS[status]} className={className} />;
}
