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
  /** LR acknowledgement damage amount, paise. Null for GRNs. */
  damageAmountPaise: bigint | null;
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

/** GRN at rail head, or one LR's share of a branch GRN. */
export const grnClaimFacts = (
  lines: ClaimSourceLine[],
  damagesBy: GRNDamagesBy | null,
): ClaimSourceFacts => buildFacts(lines, null, causeFromDamagesBy(damagesBy));

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
