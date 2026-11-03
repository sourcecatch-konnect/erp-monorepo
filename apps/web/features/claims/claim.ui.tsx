import type {
  ClaimCause,
  ClaimDetail,
  ClaimOrigin,
  ClaimRecoverySource,
  ClaimRecoveryStatus,
  ClaimStatus,
  ClaimType,
} from "@skerp/types";
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

export const CLAIM_ORIGIN_LABELS: Record<ClaimOrigin, string> = {
  LR_ACK: "LR acknowledgement",
  GRN: "GRN at rail head",
  RAIL_BRANCH_GRN: "GRN at branch",
  MANUAL: "Raised by hand",
};

export const RECOVERY_SOURCE_LABELS: Record<ClaimRecoverySource, string> = {
  INSURANCE: "Insurance",
  TRANSPORTER: "Transporter",
  DRIVER: "Driver",
  LABOUR: "Labour",
  RAILWAY: "Railway",
  OTHER: "Other",
};

type Tone = { label: string; style: string; dot: string };

const WARNING = { style: "border-warning/30 bg-warning/10 text-foreground", dot: "bg-warning" };
const PRIMARY = { style: "border-primary/30 bg-primary/10 text-primary", dot: "bg-primary" };
const SUCCESS = { style: "border-success/30 bg-success/10 text-foreground", dot: "bg-success" };
const DESTRUCTIVE = {
  style: "border-destructive/30 bg-destructive/10 text-destructive",
  dot: "bg-destructive",
};
const MUTED = { style: "border-border bg-muted text-muted-foreground", dot: "bg-muted-foreground" };

export const CLAIM_STATUS: Record<ClaimStatus, Tone> = {
  PENDING: { label: "Pending", ...WARNING },
  ACTIVE: { label: "Active", ...PRIMARY },
  SETTLED: { label: "Settled", ...SUCCESS },
  REJECTED: { label: "Rejected", ...DESTRUCTIVE },
  CANCELLED: { label: "Cancelled", ...MUTED },
};

const RECOVERY_STATUS: Record<ClaimRecoveryStatus, Tone> = {
  FILED: { label: "Filed", ...WARNING },
  APPROVED: { label: "Approved", ...PRIMARY },
  RECEIVED: { label: "Received", ...SUCCESS },
  REJECTED: { label: "Rejected", ...DESTRUCTIVE },
};

function ToneBadge({ tone }: { tone: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-semibold",
        tone.style,
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", tone.dot)} />
      {tone.label}
    </span>
  );
}

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  return <ToneBadge tone={CLAIM_STATUS[status]} />;
}

export function RecoveryStatusBadge({ status }: { status: ClaimRecoveryStatus }) {
  return <ToneBadge tone={RECOVERY_STATUS[status]} />;
}

/** The document that raised the claim, and where to open it. */
export const claimSourceLink = (
  claim: Pick<ClaimDetail, "origin" | "originRefId" | "sourceNumber" | "lr">,
): { label: string; href: string | null } => {
  switch (claim.origin) {
    case "LR_ACK":
      return { label: "LR acknowledgement", href: `/lorry-receipts/${claim.lr.groupId}` };
    case "GRN":
      return {
        label: claim.sourceNumber ? `GRN ${claim.sourceNumber}` : "GRN at rail head",
        href: claim.originRefId ? `/vp-management/grn/${claim.originRefId}` : null,
      };
    case "RAIL_BRANCH_GRN":
      return {
        label: "GRN at branch",
        href: claim.originRefId ? `/vp-management/branch-grn/${claim.originRefId}` : null,
      };
    case "MANUAL":
      return { label: "Raised by hand", href: null };
  }
};

/** Damaged / short quantities in one phrase, e.g. "5 damaged · 2 short". */
export const quantityText = (damagedQty: number, shortageQty: number) =>
  [
    damagedQty > 0 ? `${damagedQty} damaged` : null,
    shortageQty > 0 ? `${shortageQty} short` : null,
  ]
    .filter(Boolean)
    .join(" · ") || "—";
