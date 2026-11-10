import type { ClaimCause, ClaimStatus, ClaimType } from "@skerp/types";

/**
 * C2 — what a source document (LR acknowledgement, GRN at rail head, branch
 * GRN) says about one LR's damage/shortage, and what that means for the
 * auto-raised claim. Pure: no DB, so the trigger rules are unit-tested.
 */

export type ClaimSourceLine = {
  lrGoodsId: string | null;
  goodsName: string;
  damagedQty: number;
  shortageQty: number;
};

export type ClaimSourceFacts = {
  /** Only the goods lines with damage or shortage. */
  lines: ClaimSourceLine[];
  damagedQty: number;
  shortageQty: number;
  /**
   * What the loss is worth, paise. On an LR acknowledgement this is the
   * damage amount somebody actually entered. On a GRN it is a pro-rata
   * estimate off the LR's invoice (see `proRataLossPaise`), or null when one
   * cannot be derived.
   */
  damageAmountPaise: bigint | null;
  /** True when `damageAmountPaise` was derived rather than entered. */
  amountIsEstimate?: boolean;
  causedBy: ClaimCause | null;
};

/** The source figures last applied to (or noted on) a claim, kept in ClaimEvent.payload. */
export type ClaimSourceSnapshot = {
  damagedQty: number;
  shortageQty: number;
  damageAmountPaise: number;
  causedBy: ClaimCause | null;
};

const round4 = (value: number) => Math.round(value * 10_000) / 10_000;

/**
 * What the damaged and short units are worth, pro-rata on the LR's invoice.
 *
 * Only the LR acknowledgement carries a rupee figure; a GRN at the rail head
 * or branch records quantities, because the supervisor counts cartons rather
 * than pricing them. Those claims used to arrive at zero, which made them
 * invisible to the high-value alert and understated every cost report until
 * somebody assessed them.
 *
 * So a GRN claim now opens with an *estimate*: the LR's declared invoice
 * value spread evenly across its booked units, times the units lost. It is a
 * starting figure for the assessor, never a settlement — the assessor sets
 * the real claimed amount, and nothing is paid on this number.
 *
 * Returns null when it cannot be derived honestly: no invoice value, no
 * booked quantity, or nothing lost. A wrong estimate is worse than none.
 */
export const proRataLossPaise = (input: {
  invoiceAmountPaise: bigint | null;
  /** Total booked units across the LR's goods lines. */
  bookedQty: number;
  /** Units damaged plus units short. */
  lostQty: number;
}): bigint | null => {
  const { invoiceAmountPaise, bookedQty, lostQty } = input;
  if (invoiceAmountPaise === null || invoiceAmountPaise <= 0n) return null;
  if (bookedQty <= 0 || lostQty <= 0) return null;
  // Cap at the whole invoice: more lost than booked is a data error, and the
  // estimate must not exceed what the consignment was declared to be worth.
  const ratio = Math.min(lostQty / bookedQty, 1);
  const value = (Number(invoiceAmountPaise) * ratio);
  const paise = BigInt(Math.round(value));
  return paise > 0n ? paise : null;
};

const buildFacts = (
  lines: ClaimSourceLine[],
  damageAmountPaise: bigint | null,
  causedBy: ClaimCause | null,
): ClaimSourceFacts => {
  const lossLines = lines
    .map((line) => ({
      ...line,
      damagedQty: round4(Math.max(line.damagedQty, 0)),
      shortageQty: round4(Math.max(line.shortageQty, 0)),
    }))
    .filter((line) => line.damagedQty > 0 || line.shortageQty > 0);
  return {
    lines: lossLines,
    damagedQty: round4(lossLines.reduce((sum, line) => sum + line.damagedQty, 0)),
    shortageQty: round4(lossLines.reduce((sum, line) => sum + line.shortageQty, 0)),
    damageAmountPaise: damageAmountPaise !== null && damageAmountPaise > 0n ? damageAmountPaise : null,
    causedBy,
  };
};

/**
 * LR acknowledgement. Received qty counts everything that arrived, damaged
 * included (the ack dialog defaults it to the booked qty), so
 * shortage = booked − received. A goods line with no ack item says nothing.
 */
export const ackClaimFacts = (input: {
  goods: { id: string; name: string; quantity: number }[];
  items: { lrGoodsId: string; receivedQty: number | null; damagedQty: number | null }[];
  damageAmountPaise: bigint | null;
}): ClaimSourceFacts => {
  const itemByGoods = new Map(input.items.map((item) => [item.lrGoodsId, item]));
  const lines = input.goods.map((goods) => {
    const item = itemByGoods.get(goods.id);
    return {
      lrGoodsId: goods.id,
      goodsName: goods.name,
      damagedQty: item?.damagedQty ?? 0,
      shortageQty: item?.receivedQty == null ? 0 : goods.quantity - item.receivedQty,
    };
  });
  return buildFacts(lines, input.damageAmountPaise, null);
};

type GRNDamagesBy = "NONE" | "TRANSPORTER" | "LABOUR" | "RAILWAY" | "CUSTOMER" | "UNKNOWN";

export const causeFromDamagesBy = (damagesBy: GRNDamagesBy | null): ClaimCause | null =>
  damagesBy === null || damagesBy === "NONE" ? null : damagesBy;

/**
 * GRN at rail head, or one LR's share of a branch GRN.
 *
 * `lrValue` lets the claim open with a pro-rata estimate instead of zero —
 * see `proRataLossPaise`. Omit it and the claim opens unpriced, as before.
 */
export const grnClaimFacts = (
  lines: ClaimSourceLine[],
  damagesBy: GRNDamagesBy | null,
  lrValue?: { invoiceAmountPaise: bigint | null; bookedQty: number },
): ClaimSourceFacts => {
  const facts = buildFacts(lines, null, causeFromDamagesBy(damagesBy));
  if (!lrValue) return facts;
  return {
    ...facts,
    damageAmountPaise: proRataLossPaise({
      invoiceAmountPaise: lrValue.invoiceAmountPaise,
      bookedQty: lrValue.bookedQty,
      lostQty: facts.damagedQty + facts.shortageQty,
    }),
    /** Flags the figure as derived, so the UI can say so and the assessor
     *  knows it is not something the customer actually asked for. */
    amountIsEstimate: true,
  };
};

/** Branch GRN items belong to several LRs: group them per LR. */
export const groupLinesByLr = <T extends ClaimSourceLine & { lrId: string }>(lines: T[]) => {
  const byLr = new Map<string, ClaimSourceLine[]>();
  for (const { lrId, ...line } of lines) {
    byLr.set(lrId, [...(byLr.get(lrId) ?? []), line]);
  }
  return byLr;
};

export const hasClaimableLoss = (facts: ClaimSourceFacts | null): facts is ClaimSourceFacts =>
  facts !== null &&
  (facts.damagedQty > 0 || facts.shortageQty > 0 || facts.damageAmountPaise !== null);

/** Loss stays manual-only (C4): an automatic claim is damage unless only goods are short. */
export const claimTypeFor = (facts: ClaimSourceFacts): ClaimType =>
  facts.shortageQty > 0 && facts.damagedQty === 0 ? "SHORTAGE" : "DAMAGE";

/** A source with no loss snapshots as all-zero, whatever else it says. */
const sourceSnapshot = (facts: ClaimSourceFacts | null): ClaimSourceSnapshot => {
  const loss = hasClaimableLoss(facts) ? facts : null;
  return {
    damagedQty: loss?.damagedQty ?? 0,
    shortageQty: loss?.shortageQty ?? 0,
    damageAmountPaise: Number(loss?.damageAmountPaise ?? 0n),
    causedBy: loss?.causedBy ?? null,
  };
};

const sameSnapshot = (a: ClaimSourceSnapshot, b: ClaimSourceSnapshot) =>
  a.damagedQty === b.damagedQty &&
  a.shortageQty === b.shortageQty &&
  a.damageAmountPaise === b.damageAmountPaise &&
  a.causedBy === b.causedBy;

/* ------------------------------------------------------------------ */
/* Existing claim                                                      */
/* ------------------------------------------------------------------ */

/** Payload written on every event the sync records. */
export type ClaimSyncEventPayload = { automatic: true; source: ClaimSourceSnapshot };

export const syncEventPayload = (facts: ClaimSourceFacts | null): ClaimSyncEventPayload => ({
  automatic: true,
  source: sourceSnapshot(facts),
});

export type ClaimSyncState = {
  status: ClaimStatus;
  /** Cancelled by the sync (damage removed), not by a person. */
  autoCancelled: boolean;
  /** Source figures as of the last sync event; null if the sync never wrote one. */
  lastSource: ClaimSourceSnapshot | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const CAUSES = new Set<string>([
  "TRANSPORTER",
  "LABOUR",
  "RAILWAY",
  "CUSTOMER",
  "DRIVER",
  "INSURED_EVENT",
  "UNKNOWN",
]);

const snapshotFromPayload = (payload: unknown): ClaimSourceSnapshot | null => {
  if (!isRecord(payload) || payload.automatic !== true || !isRecord(payload.source)) return null;
  const { damagedQty, shortageQty, damageAmountPaise, causedBy } = payload.source;
  if (
    typeof damagedQty !== "number" ||
    typeof shortageQty !== "number" ||
    typeof damageAmountPaise !== "number"
  ) {
    return null;
  }
  return {
    damagedQty,
    shortageQty,
    damageAmountPaise,
    causedBy: typeof causedBy === "string" && CAUSES.has(causedBy) ? (causedBy as ClaimCause) : null,
  };
};

/** `events` newest first. */
export const claimSyncState = (claim: {
  status: ClaimStatus;
  events: { toStatus: ClaimStatus | null; payload: unknown }[];
}): ClaimSyncState => {
  const lastCancel = claim.events.find((event) => event.toStatus === "CANCELLED");
  return {
    status: claim.status,
    autoCancelled:
      claim.status === "CANCELLED" &&
      lastCancel !== undefined &&
      snapshotFromPayload(lastCancel.payload) !== null,
    lastSource:
      claim.events.map((event) => snapshotFromPayload(event.payload)).find(Boolean) ?? null,
  };
};

/* ------------------------------------------------------------------ */
/* Decision                                                            */
/* ------------------------------------------------------------------ */

export type ClaimSyncAction =
  /** Nothing to do. */
  | "NONE"
  /** New PENDING claim. */
  | "CREATE"
  /** PENDING claim: refresh quantities, goods lines and amounts from the source. */
  | "UPDATE"
  /** PENDING claim whose damage is gone: cancel it. */
  | "CANCEL"
  /** Auto-cancelled claim whose damage is back: PENDING again. */
  | "REOPEN"
  /** Assessed, settled, rejected or person-cancelled: never overwritten, only a timeline note. */
  | "NOTE";

export const planClaimSync = (
  existing: ClaimSyncState | null,
  facts: ClaimSourceFacts | null,
): ClaimSyncAction => {
  const loss = hasClaimableLoss(facts);
  const unchanged =
    existing?.lastSource != null && sameSnapshot(existing.lastSource, sourceSnapshot(facts));

  if (!existing) return loss ? "CREATE" : "NONE";
  if (existing.status === "PENDING") {
    if (!loss) return "CANCEL";
    return unchanged ? "NONE" : "UPDATE";
  }
  if (existing.status === "CANCELLED" && existing.autoCancelled) return loss ? "REOPEN" : "NONE";
  return unchanged ? "NONE" : "NOTE";
};
