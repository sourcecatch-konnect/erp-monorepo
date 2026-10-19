import { describe, expect, it } from "vitest";

import { toEligible, type LrRow } from "../calculators/transporter.js";

/** One truck (LR group) with three LRs; the truck amounts live on the group. */
const lrOfTruck = (id: string, detention: bigint): LrRow =>
  ({
    id,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    lrNumber: id.toUpperCase(),
    groupId: "g1",
    group: {
      groupNumber: "G-1",
      originBranchId: "b1",
      marketVehicleNumber: "MH19AB1234",
      marketFreightAmount: 9_000_000n,
      marketAdvanceAmount: 2_000_000n,
      marketCommissionAmount: 50_000n,
      marketHamaliAmount: 100_000n,
      marketTdsAmount: 90_000n,
      lorryReceipts: [{ id: "lr1" }],
    },
    delivery: { deliveredAt: new Date("2026-10-03T00:00:00Z") },
    acknowledgement: { detentionAmount: detention, damageAmount: 0n },
  }) as LrRow;

describe("transporter line amounts (ERP-58)", () => {
  const lines = [
    toEligible(lrOfTruck("lr1", 0n)),
    toEligible(lrOfTruck("lr2", 150_000n)),
    toEligible(lrOfTruck("lr3", 0n)),
  ];

  it("counts the truck's freight, advance, commission, hamali and TDS once", () => {
    const sum = (key: "freightPaise" | "advancePaise" | "commissionPaise" | "hamaliPaise" | "tdsPaise") =>
      lines.reduce((total, line) => total + line[key], 0n);
    expect(sum("freightPaise")).toBe(9_000_000n);
    expect(sum("advancePaise")).toBe(2_000_000n);
    expect(sum("commissionPaise")).toBe(50_000n);
    expect(sum("hamaliPaise")).toBe(100_000n);
    expect(sum("tdsPaise")).toBe(90_000n);
  });

  it("puts the truck amounts on the first LR only", () => {
    expect(lines.map((line) => line.ownsTruckAmounts)).toEqual([true, false, false]);
    expect(lines[1]!.freightPaise).toBe(0n);
  });

  it("keeps each LR's own detention", () => {
    expect(lines.map((line) => line.detentionPaise)).toEqual([0n, 150_000n, 0n]);
  });
});
