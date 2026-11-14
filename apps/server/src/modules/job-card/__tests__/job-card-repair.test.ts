import { describe, expect, it, vi } from "vitest";
import {
  repairControlActionSchema,
  repairInspectionSchema,
  repairReleaseSchema,
} from "@skerp/validators";
import type { Prisma } from "../../../../generated/prisma/index.js";
import {
  actOnRepairTx,
  assertRepairClearanceTx,
  assertVehicleDispatchableTx,
  recordCompletedRepairTx,
} from "../job-card-repair.service.js";
const inspection = {
  brakes: "PASS",
  steering: "PASS",
  tyres: "PASS",
  lights: "PASS",
  leaks: "NA",
  reference: "TECH-1",
  notes: "",
} as const;
const release = { ...inspection, roadworthyConfirmed: true } as const;
const start = () =>
  repairControlActionSchema.parse({
    clientRequestId: "11111111-1111-4111-8111-111111111111",
    version: 0,
    action: "START",
    reason: "Brake service",
    replacementIntent: "Replace pads",
    inspection,
  });
function fixture() {
  const card = {
    id: "card",
    branchId: "branch",
    vehicleId: "vehicle",
    status: "DRAFT",
    truckStatus: "AT_HO",
    version: 1,
  };
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    $queryRaw: vi.fn().mockResolvedValue([{ id: "vehicle" }]),
    jobCard: {
      findUnique: vi.fn().mockResolvedValue(card),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        repairControlRequired: true,
        repairControl: null,
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    vehicle: {
      findUniqueOrThrow: vi
        .fn()
        .mockResolvedValue({ status: "AVAILABLE", maintenanceHold: false }),
      update: vi.fn().mockResolvedValue({}),
    },
    vehicleTrip: { findFirst: vi.fn().mockResolvedValue(null) },
    jobCardRepairControl: {
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    jobCardRepairEvent: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
  };
  return { tx, card, db: tx as unknown as Prisma.TransactionClient };
}
describe("job-card inspection and vehicle hold", () => {
  it("requires documented findings and a resolved release checklist", () => {
    expect(
      repairInspectionSchema.safeParse({ ...inspection, brakes: "ATTENTION" })
        .success,
    ).toBe(false);
    expect(
      repairReleaseSchema.safeParse({ ...release, brakes: "ATTENTION" })
        .success,
    ).toBe(false);
    expect(
      repairReleaseSchema.safeParse({ ...release, roadworthyConfirmed: false })
        .success,
    ).toBe(false);
    expect(
      repairControlActionSchema.safeParse({ ...start(), inspection: undefined })
        .success,
    ).toBe(false);
  });
  it("starts a scoped repair under vehicle lock without changing trip status", async () => {
    const { tx, db } = fixture();
    await actOnRepairTx(db, "card", "branch", start(), "maker");
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.jobCard.updateMany.mock.invocationCallOrder[0]!,
    );
    expect(tx.vehicle.update).toHaveBeenCalledWith({
      where: { id: "vehicle" },
      data: { maintenanceHold: true },
    });
    expect(tx.jobCardRepairControl.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "IN_PROGRESS",
          replacementIntent: "Replace pads",
        }),
      }),
    );
  });
  it("blocks HO repair on an active trip, but allows in-transit repair without closing it", async () => {
    const { tx, card, db } = fixture();
    tx.vehicleTrip.findFirst.mockResolvedValue({ id: "active" });
    await expect(
      actOnRepairTx(db, "card", "branch", start(), "maker"),
    ).rejects.toThrow("in-transit");
    tx.jobCard.findUnique.mockResolvedValue({
      ...card,
      truckStatus: "IN_TRANSIT",
    });
    await actOnRepairTx(db, "card", "branch", start(), "maker");
    expect(tx.vehicle.update).toHaveBeenCalledWith({
      where: { id: "vehicle" },
      data: { maintenanceHold: true },
    });
  });
  it.each([0, 1])(
    "clears one repair while retaining %s other active repair holds",
    async (other) => {
      const { tx, db } = fixture();
      tx.jobCardRepairControl.findUnique.mockResolvedValue({
        status: "IN_PROGRESS",
        version: 1,
      });
      tx.jobCardRepairControl.count.mockResolvedValue(other);
      await actOnRepairTx(
        db,
        "card",
        "branch",
        { ...start(), action: "RELEASE", version: 1, release },
        "reviewer",
      );
      expect(tx.vehicle.update).toHaveBeenCalledWith({
        where: { id: "vehicle" },
        data: { maintenanceHold: other > 0 },
      });
      expect(tx.jobCardRepairControl.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "RELEASED",
            clearedById: "reviewer",
          }),
        }),
      );
    },
  );
  it("rejects cross-branch access and stale versions before mutations", async () => {
    const { tx, db } = fixture();
    await expect(
      actOnRepairTx(db, "card", "other", start(), "maker"),
    ).rejects.toThrow("not found");
    await expect(
      actOnRepairTx(db, "card", "branch", { ...start(), version: 2 }, "maker"),
    ).rejects.toThrow("changed");
    expect(tx.vehicle.update).not.toHaveBeenCalled();
  });
  it("replays matching requests, rejects changed payloads and never creates another hold", async () => {
    const { tx, db } = fixture();
    await actOnRepairTx(db, "card", "branch", start(), "maker");
    const saved = tx.jobCardRepairEvent.create.mock.calls[0]![0].data;
    tx.jobCardRepairEvent.findUnique.mockResolvedValue(saved);
    await actOnRepairTx(db, "card", "branch", start(), "maker");
    await expect(
      actOnRepairTx(
        db,
        "card",
        "branch",
        { ...start(), reason: "Different" },
        "maker",
      ),
    ).rejects.toThrow("already used");
    expect(tx.jobCardRepairControl.create).toHaveBeenCalledTimes(1);
  });
  it("blocks dispatch and new financial finalisation while preserving legacy records", async () => {
    const { tx, db } = fixture();
    tx.vehicle.findUniqueOrThrow.mockResolvedValue({ maintenanceHold: true });
    await expect(assertVehicleDispatchableTx(db, "vehicle")).rejects.toThrow(
      "repair hold",
    );
    await expect(assertRepairClearanceTx(db, "card")).rejects.toThrow(
      "clearance",
    );
    tx.jobCard.findUniqueOrThrow.mockResolvedValue({
      repairControlRequired: false,
      repairControl: null,
    });
    await expect(assertRepairClearanceTx(db, "card")).resolves.toBeUndefined();
  });
  it("records completed work without touching another card's hold", async () => {
    const { tx, db } = fixture();
    await recordCompletedRepairTx(
      db,
      "card",
      {
        maintenanceReason: "Service",
        replacementIntent: "No replacement",
        inspection,
        release,
      },
      "reviewer",
      start().clientRequestId,
      new Date("2026-11-13T08:00:00Z"),
      new Date("2026-11-13T09:00:00Z"),
    );
    expect(tx.vehicle.update).not.toHaveBeenCalled();
    expect(tx.jobCardRepairControl.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "RELEASED" }),
      }),
    );
  });
  it("uses the completion input's minute precision when checking repair start", async () => {
    const { tx, db } = fixture();
    tx.jobCard.findUniqueOrThrow.mockResolvedValue({
      repairControlRequired: true,
      repairControl: {
        status: "RELEASED",
        startedAt: new Date("2026-11-14T08:30:45.123Z"),
      },
    });
    await expect(
      assertRepairClearanceTx(db, "card", new Date("2026-11-14T08:30:00Z")),
    ).resolves.toBeUndefined();
    await expect(
      assertRepairClearanceTx(db, "card", new Date("2026-11-14T08:29:00Z")),
    ).rejects.toThrow("precede repair start");
  });
  it("propagates event failures so hold and control roll back with their transaction", async () => {
    const { tx, db } = fixture();
    tx.jobCardRepairEvent.create.mockRejectedValue(new Error("Audit failed"));
    await expect(
      actOnRepairTx(db, "card", "branch", start(), "maker"),
    ).rejects.toThrow("Audit failed");
  });
});
