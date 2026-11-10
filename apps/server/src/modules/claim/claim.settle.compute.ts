import type { ClaimSettlementMode, ClaimStatus } from "@skerp/types";

/** ₹35,000.00 — for claim timeline notes and error messages. */
export const rupeesText = (paise: bigint) =>
  `₹${(Number(paise) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const SETTLEMENT_MODE_TEXT: Record<ClaimSettlementMode, string> = {
  RECEIPT_DEDUCTION: "deducted on a receipt",
  CREDIT_NOTE: "credit note",
  PAID_SEPARATELY: "paid separately",
};

/** Exactly the limit is still within it. */
export const needsSettlementApproval = (amountPaise: bigint, limitPaise: bigint) =>
  amountPaise > limitPaise;

/**
 * Why this claim can't be settled for `amountPaise`, or null. The server
 * checks this on request and again on approval.
 */
export const settleBlocker = (
  claim: {
    status: ClaimStatus;
    goodsValuePaise: bigint | null;
    causedBy: string | null;
    claimedAmountPaise: bigint;
  },
  amountPaise: bigint,
  /** Non-rejected recoveries already on the claim (C5). */
  recoveriesPaise = 0n,
): string | null => {
  if (claim.status !== "ACTIVE") return "Only an assessed (active) claim can be settled";
  if (claim.goodsValuePaise === null || claim.causedBy === null)
    return "Fill in the goods value and who caused it before settling";
  if (amountPaise <= 0n) return "The settled amount must be more than zero";
  if (amountPaise > claim.claimedAmountPaise)
    return `The settled amount can't be more than the ${rupeesText(claim.claimedAmountPaise)} claimed`;
  if (amountPaise < recoveriesPaise)
    return `${rupeesText(recoveriesPaise)} is already being recovered — the settlement can't be less than that`;
  return null;
};

/* ------------------------------------------------------------------ */
/* C5 — recovery lines                                                 */
/* ------------------------------------------------------------------ */

/** Recoveries can't add up to more than the loss: settled, or claimed until settled. */
export const recoveryCapPaise = (claim: {
  settledAmountPaise: bigint | null;
  claimedAmountPaise: bigint;
}) => claim.settledAmountPaise ?? claim.claimedAmountPaise;

/**
 * Why `addPaise` more can't be recovered on this claim, or null.
 * `committedPaise` = the claim's recoveries that aren't rejected.
 */
export const recoveryBlocker = (
  claim: { status: ClaimStatus; settledAmountPaise: bigint | null; claimedAmountPaise: bigint },
  committedPaise: bigint,
  addPaise: bigint,
): string | null => {
  if (claim.status !== "ACTIVE" && claim.status !== "SETTLED")
    return "Recovery can only be recorded on an active or settled claim";
  const cap = recoveryCapPaise(claim);
  if (committedPaise + addPaise > cap) {
    const left = cap > committedPaise ? cap - committedPaise : 0n;
    return `Recoveries can't add up to more than the ${rupeesText(cap)} ${claim.settledAmountPaise === null ? "claimed" : "settled"} — only ${rupeesText(left)} is left to recover`;
  }
  return null;
};

/**
 * Why this claim's loss can't be recovered from a transporter, or null.
 *
 * Confirmed with Accounts 2026-11-07: when the consignment moved on SK's own
 * fleet there is nobody to recover from — the company carried it and the
 * company bears the loss. A transporter recovery only arises when the LR was
 * hauled by a market vehicle, and then only from the broker who hauled it.
 *
 * Without this the register fills with recoveries nobody can ever collect,
 * and worse, the vendor-payment slip would deduct them from whichever broker
 * happened to be picked.
 */
export const transporterRecoveryBlocker = (haulage: {
  isMarketVehicle: boolean;
  marketTransportId: string | null;
}): string | null => {
  if (!haulage.isMarketVehicle)
    return "This consignment moved on SK's own vehicle, so there is no transporter to recover from. The company bears this loss.";
  if (!haulage.marketTransportId)
    return "This LR is marked as a market vehicle but no transporter is recorded against it — fix the LR before recovering from a broker.";
  return null;
};

/**
 * Transporter and driver recoveries come back through their payments (vendor
 * slip — C7, salary run — C6), so they're never marked received by hand here.
 */
export const RECOVERED_ELSEWHERE: Partial<Record<string, string>> = {
  TRANSPORTER: "A transporter / broker recovery is deducted on their vendor payment slip",
  DRIVER: "A driver recovery is deducted from their salary run",
};

/**
 * Whether the linked receipt deduction / credit note can carry this
 * settlement. `linkedClaimNumber` is the claim it already settles, if any.
 */
export const settlementLinkBlocker = (link: {
  kind: "receipt deduction" | "credit note";
  availablePaise: bigint;
  amountPaise: bigint;
  sameCustomer: boolean;
  linkedClaimNumber: string | null;
}): string | null => {
  if (link.linkedClaimNumber)
    return `This ${link.kind} already settles claim ${link.linkedClaimNumber}`;
  if (!link.sameCustomer) return `This ${link.kind} belongs to a different customer`;
  if (link.amountPaise > link.availablePaise)
    return `The ${link.kind} is only ${rupeesText(link.availablePaise)} — it doesn't cover ${rupeesText(link.amountPaise)}`;
  return null;
};

/** One claim can't be raised for more goods than the LR carried. */
export const claimItemsBlocker = (
  items: { lrGoodsId: string; damagedQty: number; shortageQty: number }[],
  goods: { id: string; name: string; quantity: number }[],
): string | null => {
  const byId = new Map(goods.map((line) => [line.id, line]));
  const seen = new Set<string>();
  for (const item of items) {
    const line = byId.get(item.lrGoodsId);
    if (!line) return "The goods lines must belong to this LR";
    if (seen.has(item.lrGoodsId)) return `${line.name} is listed twice`;
    seen.add(item.lrGoodsId);
    if (item.damagedQty + item.shortageQty > line.quantity)
      return `${line.name}: damaged + short (${item.damagedQty + item.shortageQty}) is more than the ${line.quantity} booked`;
  }
  return null;
};
