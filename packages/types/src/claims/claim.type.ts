import type { z } from "zod";
import type {
  claimCauseSchema,
  claimEventTypeSchema,
  claimOriginSchema,
  claimRecoverySourceSchema,
  claimRecoveryStatusSchema,
  claimStatusSchema,
  claimTypeSchema,
} from "@skerp/validators";

export type ClaimType = z.infer<typeof claimTypeSchema>;
export type ClaimOrigin = z.infer<typeof claimOriginSchema>;
export type ClaimCause = z.infer<typeof claimCauseSchema>;
export type ClaimStatus = z.infer<typeof claimStatusSchema>;
export type ClaimRecoverySource = z.infer<typeof claimRecoverySourceSchema>;
export type ClaimRecoveryStatus = z.infer<typeof claimRecoveryStatusSchema>;
export type ClaimEventType = z.infer<typeof claimEventTypeSchema>;

/** One row of the claims register (GET /claims). Money in paise. */
export type ClaimListRow = {
  id: string;
  claimNumber: string;
  claimDate: string;
  claimType: ClaimType;
  origin: ClaimOrigin;
  causedBy: ClaimCause | null;
  status: ClaimStatus;
  damagedQty: number;
  shortageQty: number;
  claimedAmountPaise: number;
  settledAmountPaise: number | null;
  /** Approved + received recoveries. */
  recoveredAmountPaise: number;
  /** Settled − recovered; null until the claim is settled. */
  netLossPaise: number | null;
  branch: { id: string; name: string; branchCode: string };
  customer: { id: string; name: string };
  lr: { id: string; lrNumber: string };
  createdAt: string;
};
