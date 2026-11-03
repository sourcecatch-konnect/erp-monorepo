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
  /** groupId is what the LR page (/lorry-receipts/[groupId]) is keyed by. */
  lr: { id: string; lrNumber: string; groupId: string };
  createdAt: string;
};

/** One tile of the register's summary strip (GET /claims/summary). */
export type ClaimStatusSummary = {
  status: ClaimStatus;
  count: number;
  claimedAmountPaise: number;
  settledAmountPaise: number;
};

export type ClaimPerson = { id: string; name: string };

/** GET /claims/:id. Money in paise. */
export type ClaimDetail = {
  id: string;
  claimNumber: string;
  fyCode: string;
  claimDate: string;
  claimType: ClaimType;
  origin: ClaimOrigin;
  /** LRAcknowledgement / GRN / RailBranchGRN id; null for manual claims. */
  originRefId: string | null;
  /** GRN number when origin is GRN, for the source link. */
  sourceNumber: string | null;
  causedBy: ClaimCause | null;
  status: ClaimStatus;
  damagedQty: number;
  shortageQty: number;
  goodsValuePaise: number | null;
  claimedAmountPaise: number;
  settledAmountPaise: number | null;
  recoveredAmountPaise: number;
  netLossPaise: number | null;
  basisDescription: string | null;
  settledAt: string | null;
  rejectedReason: string | null;
  cancelReason: string | null;
  version: number;
  branch: { id: string; name: string; branchCode: string };
  customer: { id: string; name: string };
  lr: {
    id: string;
    lrNumber: string;
    groupId: string;
    groupNumber: string;
    consignor: { id: string; name: string };
    consignee: { id: string; name: string };
  };
  items: {
    id: string;
    lrGoodsId: string | null;
    goodsName: string;
    damagedQty: number;
    shortageQty: number;
    valuePaise: number | null;
  }[];
  recoveries: {
    id: string;
    source: ClaimRecoverySource;
    /** Transporter / driver / labour name, or the typed party name for insurance and others. */
    partyName: string | null;
    amountPaise: number;
    status: ClaimRecoveryStatus;
    referenceNo: string | null;
    remarks: string | null;
    createdAt: string;
  }[];
  /** Oldest first. */
  events: {
    id: string;
    /** A ClaimEventType; typed as string because the column is free text. */
    eventType: string;
    fromStatus: ClaimStatus | null;
    toStatus: ClaimStatus | null;
    note: string | null;
    createdAt: string;
    /** Null for system events. */
    actor: ClaimPerson | null;
  }[];
  createdBy: ClaimPerson;
  createdAt: string;
  updatedAt: string;
};
