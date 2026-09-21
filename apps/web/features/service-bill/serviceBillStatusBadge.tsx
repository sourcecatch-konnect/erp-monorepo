import { StatusPill, type StatusPillTone } from "@/features/masters/_shared/StatusPill";
import type { ServiceBillStatus } from "./api/service-bill.service";

const STATUS_LABELS: Record<ServiceBillStatus, string> = {
  DRAFT: "Draft",
  POSTED: "Posted",
  CANCELLED: "Cancelled",
};

const STATUS_TONE: Record<ServiceBillStatus, StatusPillTone> = {
  DRAFT: "slate",
  POSTED: "emerald",
  CANCELLED: "rose",
};

type ServiceBillStatusBadgeProps = {
  status: ServiceBillStatus;
  className?: string;
};

export function ServiceBillStatusBadge({
  status,
  className,
}: ServiceBillStatusBadgeProps) {
  return <StatusPill tone={STATUS_TONE[status]} label={STATUS_LABELS[status]} className={className} />;
}
