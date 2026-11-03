import type { ClaimCause, ClaimStatus, ClaimType } from "@skerp/types";
import { cn } from "@/lib/utils";

export const CLAIM_TYPE_LABELS: Record<ClaimType, string> = {
  DAMAGE: "Damage",
  SHORTAGE: "Shortage",
  LOSS: "Loss",
};

export const CLAIM_CAUSE_LABELS: Record<ClaimCause, string> = {
  TRANSPORTER: "Transporter",
  LABOUR: "Labour",
  RAILWAY: "Railway",
  CUSTOMER: "Customer",
  DRIVER: "Driver",
  INSURED_EVENT: "Insured event",
  UNKNOWN: "Unknown",
};

const CLAIM_STATUS: Record<ClaimStatus, { label: string; style: string; dot: string }> = {
  PENDING: {
    label: "Pending",
    style: "border-warning/30 bg-warning/10 text-foreground",
    dot: "bg-warning",
  },
  ACTIVE: {
    label: "Active",
    style: "border-primary/30 bg-primary/10 text-primary",
    dot: "bg-primary",
  },
  SETTLED: {
    label: "Settled",
    style: "border-success/30 bg-success/10 text-foreground",
    dot: "bg-success",
  },
  REJECTED: {
    label: "Rejected",
    style: "border-destructive/30 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
  CANCELLED: {
    label: "Cancelled",
    style: "border-border bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
};

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  const { label, style, dot } = CLAIM_STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-semibold",
        style,
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", dot)} />
      {label}
    </span>
  );
}
