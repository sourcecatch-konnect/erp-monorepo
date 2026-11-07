import { describe, expect, it } from "vitest";

import {
  approvalDefaultsFrom,
  shortageQtyOf,
  totalDamageQty,
  totalShortageQty,
  type AckLite,
} from "../ack.compare.js";

/**
 * L5 — quantities derived from the broker acknowledgement, and the figures
 * an approver starts from. The acknowledgement is broker-only since
 * 2026-11-07; the ceiling on an inflated claim is the slab, applied on the
 * payment slip.
 */

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const rupees = (n: number): bigint => BigInt(n) * 100n;

const ack = (over: Partial<AckLite> = {}): AckLite => ({
  reportingDate: d("2026-03-04"),
  unloadingDate: d("2026-03-10"),
  collectionDate: null,
  claimedDetentionDays: 6,
  claimedDetentionPaise: rupees(5000),
  parkingPaise: null,
  otherPaise: null,
  labourPaise: null,
  damagePaise: null,
  items: [
    {
      challanItemId: "i1",
      lrNumberSnapshot: "LR-1",
      totalQty: 100,
      receivedQty: 100,
      damageQty: 0,
    },
  ],
  ...over,
});

describe("shortage and damage totals", () => {
  it("derives shortage as sent minus received", () => {
    expect(
      shortageQtyOf({
        challanItemId: "i",
        lrNumberSnapshot: "LR",
        totalQty: 100,
        receivedQty: 93,
        damageQty: 2,
      }),
    ).toBe(7);
  });

  it("never reports a negative shortage", () => {
    expect(
      shortageQtyOf({
        challanItemId: "i",
        lrNumberSnapshot: "LR",
        totalQty: 100,
        receivedQty: 120,
        damageQty: 0,
      }),
    ).toBe(0);
  });

  it("sums shortage and damage across lines", () => {
    const multi = ack({
      items: [
        { challanItemId: "a", lrNumberSnapshot: "LR-1", totalQty: 100, receivedQty: 90, damageQty: 3 },
        { challanItemId: "b", lrNumberSnapshot: "LR-2", totalQty: 50, receivedQty: 45, damageQty: 1 },
      ],
    });
    expect(totalShortageQty(multi)).toBe(15);
    expect(totalDamageQty(multi)).toBe(4);
  });
});

describe("approvalDefaultsFrom", () => {
  it("copies the accepted ack's figures so accepting without edits records it verbatim", () => {
    const accepted = ack({
      claimedDetentionDays: 4,
      parkingPaise: rupees(300),
      otherPaise: rupees(50),
      labourPaise: null,
      damagePaise: rupees(900),
    });
    expect(approvalDefaultsFrom(accepted)).toEqual({
      approvedDetentionDays: 4,
      approvedParkingPaise: rupees(300),
      approvedOtherPaise: rupees(50),
      approvedLabourPaise: null,
      approvedDamagePaise: rupees(900),
      approvedShortagePaise: null,
    });
  });

  it("leaves shortage unpriced — it is a quantity, not a claimed amount", () => {
    expect(approvalDefaultsFrom(ack()).approvedShortagePaise).toBeNull();
  });
});
