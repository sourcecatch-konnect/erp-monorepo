import type { z } from "zod";
import type {
  claimAssessmentSchema,
  claimCauseSchema,
  claimEventTypeSchema,
  claimOriginSchema,
  claimReasonSchema,
  claimRecoverySourceSchema,
  claimRecoveryStatusSchema,
  claimSettlementModeSchema,
  claimStatusSchema,
  claimTypeSchema,
  createClaimSchema,
  paymentModeSchema,
  settleClaimSchema,
  addClaimRecoverySchema,
  receiveClaimRecoverySchema,
} from "@skerp/validators";

export type ClaimType = z.infer<typeof claimTypeSchema>;
export type ClaimOrigin = z.infer<typeof claimOriginSchema>;
export type ClaimCause = z.infer<typeof claimCauseSchema>;
export type ClaimStatus = z.infer<typeof claimStatusSchema>;
export type ClaimRecoverySource = z.infer<typeof claimRecoverySourceSchema>;
export type ClaimRecoveryStatus = z.infer<typeof claimRecoveryStatusSchema>;
export type ClaimEventType = z.infer<typeof claimEventTypeSchema>;
export type ClaimSettlementMode = z.infer<typeof claimSettlementModeSchema>;
type PaymentMode = z.infer<typeof paymentModeSchema>;

/** Form values (rupees as typed) — the server converts to paise. */
export type CreateClaimFormInput = z.input<typeof createClaimSchema>;
export type ClaimAssessmentFormInput = z.input<typeof claimAssessmentSchema>;
export type SettleClaimFormInput = z.input<typeof settleClaimSchema>;
export type AddClaimRecoveryFormInput = z.input<typeof addClaimRecoverySchema>;
export type ReceiveClaimRecoveryFormInput = z.input<typeof receiveClaimRecoverySchema>;

/** A cash / bank account money can go out of or come into, with its balance. */
export type ClaimFundingAccount = {
  id: string;
  name: string;
  group: "CASH" | "BANK";
  balancePaise: number;
};
export type ClaimReasonInput = z.input<typeof claimReasonSchema>;

/** An LR a claim can be raised on by hand (GET /claims/eligible-lrs). */
export type ClaimEligibleLr = {
  id: string;
  lrNumber: string;
  groupNumber: string;
  status: string;
  consignor: { id: string; name: string };
  consignee: { id: string; name: string };
  goods: { id: string; name: string; quantity: number; unit: string | null }[];
};

/** What a settlement can be linked to (GET /claims/:id/settlement-options). */
export type ClaimSettlementOptions = {
  /** Settlements above this wait for a second user with claim.approve. */
  approvalLimitPaise: number;
  receiptAllocations: {
    id: string;
    receiptNumber: string | null;
    receivedAt: string;
    billNumber: string | null;
    damageAmountPaise: number;
    /** The bill includes this claim's LR. */
    onThisLr: boolean;
  }[];
  creditNotes: {
    id: string;
    noteNumber: string;
    createdAt: string;
    billNumber: string | null;
    amountPaise: number;
    reason: string;
    onThisLr: boolean;
  }[];
  fundingAccounts: {
    id: string;
    name: string;
    group: "CASH" | "BANK";
    balancePaise: number;
  }[];
};

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
    /** 1, 2, 3… within the claim. */
    lineNo: number;
    rejectedReason: string | null;
    receivedAt: string | null;
    receiptMode: PaymentMode | null;
    receivedIntoName: string | null;
    voucher: { id: string; voucherNumber: string } | null;
    /** DRIVER source (C6): the salary run it's deducted on. */
    salaryRun: { id: string; runNumber: string; status: string } | null;
    /** TRANSPORTER source (C7): the vendor payment slip it's deducted on. */
    vendorSlip: { id: string; slipNumber: string; status: string } | null;
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
  /** Set once the claim is SETTLED. */
  settlement: {
    mode: ClaimSettlementMode;
    receipt: {
      id: string;
      receiptNumber: string | null;
      billNumber: string | null;
      damageAmountPaise: number;
    } | null;
    creditNote: {
      id: string;
      noteNumber: string;
      billId: string;
      billNumber: string | null;
      amountPaise: number;
    } | null;
    paymentMode: PaymentMode | null;
    fundingAccountName: string | null;
    referenceNo: string | null;
    note: string | null;
    voucher: { id: string; voucherNumber: string } | null;
    settledBy: ClaimPerson | null;
    approvedBy: ClaimPerson | null;
  } | null;
  /** A settlement above the limit, waiting for a second user to approve. */
  pendingSettlement: {
    amountPaise: number;
    settledAt: string;
    mode: ClaimSettlementMode;
    note: string | null;
    requestedBy: ClaimPerson | null;
    requestedAt: string | null;
  } | null;
  createdBy: ClaimPerson;
  createdAt: string;
  updatedAt: string;
};
