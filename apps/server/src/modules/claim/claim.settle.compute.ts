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
): string | null => {
  if (claim.status !== "ACTIVE") return "Only an assessed (active) claim can be settled";
  if (claim.goodsValuePaise === null || claim.causedBy === null)
    return "Fill in the goods value and who caused it before settling";
  if (amountPaise <= 0n) return "The settled amount must be more than zero";
  if (amountPaise > claim.claimedAmountPaise)
    return `The settled amount can't be more than the ${rupeesText(claim.claimedAmountPaise)} claimed`;
  return null;
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
