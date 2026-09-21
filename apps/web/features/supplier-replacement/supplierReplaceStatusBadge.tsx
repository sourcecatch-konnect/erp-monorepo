import { StatusPill, type StatusPillTone } from "@/features/masters/_shared/StatusPill";
import type { ReplacementListStatus } from "./api/supplier-replacement.service";

const STATUS_LABELS: Record<ReplacementListStatus, string> = {
  PENDING: "Pending",
  PARTIALLY_RECEIVED: "Partially received",
  RECEIVED: "Received",
  CANCELLED: "Cancelled",
};

const STATUS_TONE: Record<ReplacementListStatus, StatusPillTone> = {
  PENDING: "amber",
  PARTIALLY_RECEIVED: "orange",
  RECEIVED: "emerald",
  CANCELLED: "rose",
};

type ReplacementListStatusBadgeProps = {
  status: ReplacementListStatus;
  className?: string;
};

export function ReplacementListStatusBadge({
  status,
  className,
}: ReplacementListStatusBadgeProps) {
  return <StatusPill tone={STATUS_TONE[status]} label={STATUS_LABELS[status]} className={className} />;
}
