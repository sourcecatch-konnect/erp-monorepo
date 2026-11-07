import { describe, expect, it } from "vitest";

import {
  approvalDefaultsFrom,
  compareAcks,
  shortageQtyOf,
  totalDamageQty,
  totalShortageQty,
  type AckLite,
} from "../ack.compare.js";

/**
 * L5 — the supervisor/broker comparison is the fraud control (CONTEXT.md
 * §5.2: the broker's claim is "often inflated"). These tests pin down what
 * counts as a disagreement, because a missed mismatch is a claim nobody
 * questions.
 */

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const rupees = (n: number): bigint => BigInt(n) * 100n;

const ack = (over: Partial<AckLite> = {}): AckLite => ({
  ackType: "SUPERVISOR",
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

describe("compareAcks", () => {
  it("reports nothing when the two agree", () => {
    expect(compareAcks(ack(), ack({ ackType: "BROKER" }))).toEqual([]);
  });

  it("reports nothing when only one ack has been filed", () => {
    // There is nothing to compare against one account, and flagging the whole
    // form as mismatched would bury the real signal. `bothFiled` is how the
    // caller tells the approver that one side is absent.
    expect(compareAcks(ack(), null)).toEqual([]);
    expect(compareAcks(null, ack({ ackType: "BROKER" }))).toEqual([]);
    expect(compareAcks(null, null)).toEqual([]);
  });

  it("catches an inflated detention claim — the case this exists for", () => {
    const mismatches = compareAcks(
      ack({ claimedDetentionDays: 6, claimedDetentionPaise: rupees(5000) }),
      ack({
        ackType: "BROKER",
        claimedDetentionDays: 11,
        claimedDetentionPaise: rupees(12000),
      }),
    );
    const fields = mismatches.map((m) => m.field);
    expect(fields).toContain("claimedDetentionDays");
    expect(fields).toContain("claimedDetentionPaise");
    const days = mismatches.find((m) => m.field === "claimedDetentionDays");
    expect(days).toEqual({
      field: "claimedDetentionDays",
      supervisor: "6",
      broker: "11",
    });
  });

  it("catches disagreement about the dates that price detention", () => {
    const mismatches = compareAcks(
      ack({ unloadingDate: d("2026-03-10") }),
      ack({ ackType: "BROKER", unloadingDate: d("2026-03-14") }),
    );
    expect(mismatches.map((m) => m.field)).toContain("unloadingDate");
  });

  it("treats one side blank and the other filled as a mismatch", () => {
    // Usually means somebody has not filled their form in — the approver has
    // to see that before ruling, not after.
    const mismatches = compareAcks(
      ack({ parkingPaise: null }),
      ack({ ackType: "BROKER", parkingPaise: rupees(300) }),
    );
    expect(mismatches).toContainEqual({
      field: "parkingPaise",
      supervisor: null,
      broker: "30000",
    });
  });

  it("does not report a field both sides left blank", () => {
    const mismatches = compareAcks(
      ack({ otherPaise: null, labourPaise: null }),
      ack({ ackType: "BROKER", otherPaise: null, labourPaise: null }),
    );
    expect(mismatches.map((m) => m.field)).not.toContain("otherPaise");
    expect(mismatches.map((m) => m.field)).not.toContain("labourPaise");
  });

  it("compares derived shortage, not just the raw quantities", () => {
    const mismatches = compareAcks(
      ack({
        items: [
          { challanItemId: "a", lrNumberSnapshot: "LR-1", totalQty: 100, receivedQty: 90, damageQty: 0 },
        ],
      }),
      ack({
        ackType: "BROKER",
        items: [
          { challanItemId: "a", lrNumberSnapshot: "LR-1", totalQty: 100, receivedQty: 100, damageQty: 0 },
        ],
      }),
    );
    expect(mismatches).toContainEqual({
      field: "shortageQty",
      supervisor: "10",
      broker: "0",
    });
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
