import { describe, expect, it } from "vitest";
import {
  ackClaimFacts,
  causeFromDamagesBy,
  claimSyncState,
  claimTypeFor,
  grnClaimFacts,
  groupLinesByLr,
  hasClaimableLoss,
  planClaimSync,
  syncEventPayload,
  type ClaimSourceFacts,
  type ClaimSyncState,
} from "../claim.sync.compute.js";

const cartons = { id: "g1", name: "Cartons", quantity: 100 };
const drums = { id: "g2", name: "Drums", quantity: 10 };

const ack = (
  items: { lrGoodsId: string; receivedQty: number | null; damagedQty: number | null }[],
  damageAmountPaise: bigint | null = null,
) => ackClaimFacts({ goods: [cartons, drums], items, damageAmountPaise });

describe("ackClaimFacts — what counts as damage or shortage on an acknowledgement", () => {
  it("counts damaged quantity", () => {
    const facts = ack([{ lrGoodsId: "g1", receivedQty: 100, damagedQty: 5 }]);
    expect(facts.damagedQty).toBe(5);
    expect(facts.shortageQty).toBe(0);
    expect(facts.lines).toEqual([
      { lrGoodsId: "g1", goodsName: "Cartons", damagedQty: 5, shortageQty: 0 },
    ]);
    expect(hasClaimableLoss(facts)).toBe(true);
  });

  it("treats received below booked as shortage (received includes damaged)", () => {
    const facts = ack([{ lrGoodsId: "g1", receivedQty: 96, damagedQty: 2 }]);
    expect(facts.damagedQty).toBe(2);
    expect(facts.shortageQty).toBe(4);
  });

  it("ignores received above booked", () => {
    const facts = ack([{ lrGoodsId: "g1", receivedQty: 105, damagedQty: null }]);
    expect(hasClaimableLoss(facts)).toBe(false);
  });

  it("says nothing about goods without an ack item or with blank quantities", () => {
    const facts = ack([{ lrGoodsId: "g2", receivedQty: null, damagedQty: null }]);
    expect(facts.lines).toEqual([]);
    expect(hasClaimableLoss(facts)).toBe(false);
  });

  it("raises on a damage amount alone", () => {
    const facts = ack([], 500_000n);
    expect(facts.damageAmountPaise).toBe(500_000n);
    expect(hasClaimableLoss(facts)).toBe(true);
  });

  it("treats a zero damage amount as none", () => {
    expect(ack([], 0n).damageAmountPaise).toBeNull();
    expect(hasClaimableLoss(ack([], 0n))).toBe(false);
  });

  it("sums several goods lines and keeps decimal quantities exact", () => {
    const facts = ack([
      { lrGoodsId: "g1", receivedQty: 99.9, damagedQty: 0.1 },
      { lrGoodsId: "g2", receivedQty: 9.8, damagedQty: 0.2 },
    ]);
    expect(facts.damagedQty).toBe(0.3);
    expect(facts.shortageQty).toBe(0.3);
    expect(facts.lines).toHaveLength(2);
  });
});

describe("grnClaimFacts", () => {
  it("takes caused-by from the GRN's damages-by, NONE meaning not given", () => {
    const line = { lrGoodsId: "g1", goodsName: "Cartons", damagedQty: 3, shortageQty: 1 };
    expect(grnClaimFacts([line], "TRANSPORTER").causedBy).toBe("TRANSPORTER");
    expect(grnClaimFacts([line], "NONE").causedBy).toBeNull();
    expect(causeFromDamagesBy(null)).toBeNull();
  });

  it("has no loss when every line is clean", () => {
    const facts = grnClaimFacts(
      [{ lrGoodsId: "g1", goodsName: "Cartons", damagedQty: 0, shortageQty: 0 }],
      "LABOUR",
    );
    expect(hasClaimableLoss(facts)).toBe(false);
  });
});

describe("groupLinesByLr — a branch GRN covers several LRs", () => {
  it("splits the wagon's lines per LR", () => {
    const byLr = groupLinesByLr([
      { lrId: "lr1", lrGoodsId: "a", goodsName: "A", damagedQty: 1, shortageQty: 0 },
      { lrId: "lr2", lrGoodsId: "b", goodsName: "B", damagedQty: 0, shortageQty: 2 },
      { lrId: "lr1", lrGoodsId: "c", goodsName: "C", damagedQty: 0, shortageQty: 0 },
    ]);
    expect([...byLr.keys()]).toEqual(["lr1", "lr2"]);
    expect(byLr.get("lr1")).toHaveLength(2);
    expect(byLr.get("lr2")?.[0]).toEqual({
      lrGoodsId: "b",
      goodsName: "B",
      damagedQty: 0,
      shortageQty: 2,
    });
  });
});

describe("claimTypeFor", () => {
  it("is SHORTAGE only when goods are short and none damaged", () => {
    const facts = (damagedQty: number, shortageQty: number): ClaimSourceFacts => ({
      lines: [],
      damagedQty,
      shortageQty,
      damageAmountPaise: null,
      causedBy: null,
    });
    expect(claimTypeFor(facts(0, 4))).toBe("SHORTAGE");
    expect(claimTypeFor(facts(2, 4))).toBe("DAMAGE");
    expect(claimTypeFor(facts(2, 0))).toBe("DAMAGE");
    expect(claimTypeFor({ ...facts(0, 0), damageAmountPaise: 100n })).toBe("DAMAGE");
  });
});

/* ------------------------------------------------------------------ */
/* Sync decisions                                                      */
/* ------------------------------------------------------------------ */

const fiveDamaged = ack([{ lrGoodsId: "g1", receivedQty: 100, damagedQty: 5 }], 500_000n);
const sevenDamaged = ack([{ lrGoodsId: "g1", receivedQty: 100, damagedQty: 7 }], 500_000n);
const clean = ack([{ lrGoodsId: "g1", receivedQty: 100, damagedQty: 0 }]);

/** A claim whose last sync event recorded `facts`. */
const claimAt = (
  status: ClaimSyncState["status"],
  facts: ClaimSourceFacts | null,
  overrides: Partial<ClaimSyncState> = {},
): ClaimSyncState => ({
  status,
  autoCancelled: false,
  lastSource: syncEventPayload(facts).source,
  ...overrides,
});

describe("planClaimSync", () => {
  it("creates a claim when there is loss and no claim yet", () => {
    expect(planClaimSync(null, fiveDamaged)).toBe("CREATE");
  });

  it("does nothing without loss and without a claim", () => {
    expect(planClaimSync(null, clean)).toBe("NONE");
    expect(planClaimSync(null, null)).toBe("NONE");
  });

  it("updates the same pending claim when the source changes (5 → 7 cartons)", () => {
    expect(planClaimSync(claimAt("PENDING", fiveDamaged), sevenDamaged)).toBe("UPDATE");
  });

  it("leaves a pending claim alone when an unrelated field of the source changed", () => {
    expect(planClaimSync(claimAt("PENDING", fiveDamaged), fiveDamaged)).toBe("NONE");
  });

  it("cancels a pending claim when damage is edited back to 0 or the source is gone", () => {
    expect(planClaimSync(claimAt("PENDING", fiveDamaged), clean)).toBe("CANCEL");
    expect(planClaimSync(claimAt("PENDING", fiveDamaged), null)).toBe("CANCEL");
  });

  it("reopens an auto-cancelled claim when damage comes back", () => {
    const cancelled = claimAt("CANCELLED", null, { autoCancelled: true });
    expect(planClaimSync(cancelled, sevenDamaged)).toBe("REOPEN");
    expect(planClaimSync(cancelled, clean)).toBe("NONE");
  });

  it("never reopens a claim a person cancelled; it only notes a source change", () => {
    const cancelled = claimAt("CANCELLED", fiveDamaged);
    expect(planClaimSync(cancelled, sevenDamaged)).toBe("NOTE");
    expect(planClaimSync(cancelled, fiveDamaged)).toBe("NONE");
  });

  it("never overwrites an assessed, settled or rejected claim; notes changes once", () => {
    for (const status of ["ACTIVE", "SETTLED", "REJECTED"] as const) {
      expect(planClaimSync(claimAt(status, fiveDamaged), sevenDamaged)).toBe("NOTE");
      expect(planClaimSync(claimAt(status, fiveDamaged), clean)).toBe("NOTE");
      // After the note recorded 7, a further unrelated edit is not noted again.
      expect(planClaimSync(claimAt(status, sevenDamaged), sevenDamaged)).toBe("NONE");
    }
  });

  it("treats a GRN with damages-by set but no loss the same as no source", () => {
    const noLoss = grnClaimFacts(
      [{ lrGoodsId: "g1", goodsName: "Cartons", damagedQty: 0, shortageQty: 0 }],
      "TRANSPORTER",
    );
    expect(syncEventPayload(noLoss)).toEqual(syncEventPayload(null));
    expect(planClaimSync(claimAt("ACTIVE", null), noLoss)).toBe("NONE");
  });
});

describe("claimSyncState — reads the claim's timeline (newest first)", () => {
  const syncEvent = (toStatus: ClaimSyncState["status"] | null, facts: ClaimSourceFacts | null) => ({
    toStatus,
    payload: syncEventPayload(facts),
  });

  it("knows a claim was cancelled by the sync", () => {
    const state = claimSyncState({
      status: "CANCELLED",
      events: [syncEvent("CANCELLED", null), syncEvent("PENDING", fiveDamaged)],
    });
    expect(state.autoCancelled).toBe(true);
    expect(state.lastSource).toEqual(syncEventPayload(null).source);
  });

  it("knows a claim was cancelled by a person (no automatic payload)", () => {
    const state = claimSyncState({
      status: "CANCELLED",
      events: [
        { toStatus: "CANCELLED", payload: { reason: "Customer withdrew" } },
        syncEvent("PENDING", fiveDamaged),
      ],
    });
    expect(state.autoCancelled).toBe(false);
    expect(state.lastSource).toEqual(syncEventPayload(fiveDamaged).source);
  });

  it("ignores malformed payloads", () => {
    const state = claimSyncState({
      status: "ACTIVE",
      events: [{ toStatus: null, payload: { automatic: true, source: { damagedQty: "5" } } }],
    });
    expect(state.lastSource).toBeNull();
  });
});
