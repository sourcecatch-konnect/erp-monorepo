import { describe, expect, it } from "vitest";

import { grnClaimFacts, proRataLossPaise } from "../claim.sync.compute.js";
import { transporterRecoveryBlocker } from "../claim.settle.compute.js";

/**
 * A GRN at the rail head or branch records quantities, not money — the
 * supervisor counts cartons, he does not price them. Those claims used to
 * open at zero, which hid them from the high-value alert and understated
 * every cost report until somebody assessed them.
 *
 * They now open with a pro-rata estimate off the LR's invoice. These cases
 * pin when that estimate is produced and, more importantly, when it is
 * refused — a wrong figure on a claim is worse than no figure.
 */

const rupees = (n: number): bigint => BigInt(n) * 100n;

describe("proRataLossPaise", () => {
  it("prices the lost units as their share of the invoice", () => {
    // ₹10,000 invoice over 100 units, 5 lost → ₹500.
    expect(
      proRataLossPaise({
        invoiceAmountPaise: rupees(10_000),
        bookedQty: 100,
        lostQty: 5,
      }),
    ).toBe(rupees(500));
  });

  it("never exceeds the declared invoice value", () => {
    // More lost than booked is a data error; the estimate caps at the whole
    // consignment rather than inventing value that was never declared.
    expect(
      proRataLossPaise({
        invoiceAmountPaise: rupees(10_000),
        bookedQty: 10,
        lostQty: 25,
      }),
    ).toBe(rupees(10_000));
  });

  it.each([
    ["no invoice value", { invoiceAmountPaise: null, bookedQty: 100, lostQty: 5 }],
    ["zero invoice value", { invoiceAmountPaise: 0n, bookedQty: 100, lostQty: 5 }],
    ["no booked quantity", { invoiceAmountPaise: rupees(10_000), bookedQty: 0, lostQty: 5 }],
    ["nothing lost", { invoiceAmountPaise: rupees(10_000), bookedQty: 100, lostQty: 0 }],
  ])("refuses to guess when there is %s", (_label, input) => {
    expect(proRataLossPaise(input)).toBeNull();
  });

  it("rounds to whole paise", () => {
    // ₹100 over 3 units, 1 lost → 3333.33… paise → 3333.
    const value = proRataLossPaise({
      invoiceAmountPaise: rupees(100),
      bookedQty: 3,
      lostQty: 1,
    });
    expect(value).toBe(3333n);
  });
});

describe("grnClaimFacts", () => {
  const lines = [
    { lrGoodsId: "g1", goodsName: "Washing machines", damagedQty: 3, shortageQty: 2 },
  ];

  it("opens a GRN claim with an estimate and flags it as derived", () => {
    const facts = grnClaimFacts(lines, null, {
      invoiceAmountPaise: rupees(10_000),
      bookedQty: 100,
    });
    // 3 damaged + 2 short = 5 of 100 → ₹500.
    expect(facts.damageAmountPaise).toBe(rupees(500));
    expect(facts.amountIsEstimate).toBe(true);
  });

  it("stays unpriced when no LR value is supplied", () => {
    const facts = grnClaimFacts(lines, null);
    expect(facts.damageAmountPaise).toBeNull();
    expect(facts.amountIsEstimate).toBeUndefined();
  });

  it("stays unpriced when the LR has no invoice value", () => {
    const facts = grnClaimFacts(lines, null, {
      invoiceAmountPaise: null,
      bookedQty: 100,
    });
    expect(facts.damageAmountPaise).toBeNull();
  });
});

/**
 * Accounts, 2026-11-07: when the consignment moved on SK's own fleet there
 * is nobody to recover from — the company carried it and bears the loss. A
 * transporter recovery only arises on a market vehicle, and only from the
 * broker that hauled it.
 */
describe("transporterRecoveryBlocker", () => {
  it("blocks recovery when SK's own vehicle carried the goods", () => {
    expect(
      transporterRecoveryBlocker({ isMarketVehicle: false, marketTransportId: null }),
    ).toMatch(/own vehicle/i);
  });

  it("blocks an own-fleet LR even if a transporter id lingers on it", () => {
    expect(
      transporterRecoveryBlocker({ isMarketVehicle: false, marketTransportId: "t1" }),
    ).toMatch(/own vehicle/i);
  });

  it("blocks a market LR with no transporter recorded, rather than guessing", () => {
    expect(
      transporterRecoveryBlocker({ isMarketVehicle: true, marketTransportId: null }),
    ).toMatch(/no transporter is recorded/i);
  });

  it("allows recovery from the broker that hauled a market vehicle", () => {
    expect(
      transporterRecoveryBlocker({ isMarketVehicle: true, marketTransportId: "t1" }),
    ).toBeNull();
  });
});
