import { describe, expect, it } from "vitest";

import { toTruck, type TruckRow } from "../calculators/transporter-truck.js";

type LrInput = { id: string; status: string; detention?: bigint; damage?: bigint };

/** One market truck (LR group) worth ₹85,000 with the given LRs. */
const truckWith = (lrs: LrInput[]): TruckRow =>
  ({
    id: "g1",
    createdAt: new Date("2026-10-01T00:00:00Z"),
    groupNumber: "G-0045",
    originBranchId: "b1",
    marketVehicleNumber: "MH19AB1234",
    marketFreightAmount: 8_500_000n,
    marketAdvanceAmount: 2_000_000n,
    marketCommissionAmount: 50_000n,
    marketHamaliAmount: 100_000n,
    marketTdsAmount: 85_000n,
    lorryReceipts: lrs.map((lr) => ({
      id: lr.id,
      lrNumber: lr.id.toUpperCase(),
      status: lr.status,
      unloadingLocation: { name: "Pune DC", customer: { name: "Customer A" } },
      delivery: lr.status === "FINALISED" ? null : { deliveredAt: new Date("2026-10-03T00:00:00Z") },
      acknowledgement:
        lr.detention !== undefined || lr.damage !== undefined
          ? { detentionAmount: lr.detention ?? null, damageAmount: lr.damage ?? null }
          : null,
    })),
  }) as TruckRow;

describe("transporter truck line", () => {
  it("counts the truck amounts once and adds every LR's detention and damage", () => {
    const truck = toTruck(
      truckWith([
        { id: "lr-1", status: "ACKNOWLEDGED", detention: 0n },
        { id: "lr-2", status: "ACKNOWLEDGED", detention: 150_000n, damage: 20_000n },
      ]),
    );
    expect(truck.freightPaise).toBe(8_500_000n);
    expect(truck.advancePaise).toBe(2_000_000n);
    expect(truck.tdsPaise).toBe(85_000n);
    expect(truck.detentionPaise).toBe(150_000n);
    expect(truck.damagePaise).toBe(20_000n);
    expect(truck.lrs.map((lr) => lr.lrNumber)).toEqual(["LR-1", "LR-2"]);
    expect(truck.lrs[0]!.unloadingPoint).toBe("Customer A — Pune DC");
  });

  it("is ready only when every LR is delivered", () => {
    expect(
      toTruck(truckWith([{ id: "lr-1", status: "DELIVERED" }, { id: "lr-2", status: "ACKNOWLEDGED" }]))
        .ready,
    ).toBe(true);

    const waiting = toTruck(
      truckWith([{ id: "lr-1", status: "DELIVERED" }, { id: "lr-2", status: "FINALISED" }]),
    );
    expect(waiting.ready).toBe(false);
    expect(waiting.pendingLrNumbers).toEqual(["LR-2"]);
  });

  it("is never ready without LRs", () => {
    expect(toTruck(truckWith([])).ready).toBe(false);
  });
});
