import { StatusPill, type StatusPillTone } from "@/features/masters/_shared/StatusPill";
import type { SpareInwardStatus } from "./api/spare-inward.service";

const STATUS_LABELS: Record<SpareInwardStatus, string> = {
  DRAFT: "Draft",
  POSTED: "Posted",
  CANCELLED: "Cancelled",
};

const STATUS_TONE: Record<SpareInwardStatus, StatusPillTone> = {
  DRAFT: "slate",
  POSTED: "emerald",
  CANCELLED: "rose",
};

type SpareInwardStatusBadgeProps = {
  status: SpareInwardStatus;
  className?: string;
};

export function SpareInwardStatusBadge({
  status,
  className,
}: SpareInwardStatusBadgeProps) {
  return <StatusPill tone={STATUS_TONE[status]} label={STATUS_LABELS[status]} className={className} />;
}
