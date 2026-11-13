import { describe, expect, it, vi } from "vitest";
import {
  createJobCardSchema,
  createAndFinaliseJobCardSchema,
  updateJobCardSchema,
} from "@skerp/validators";
import type { Prisma } from "../../../../generated/prisma/index.js";
import {
  createJobCardOnceTx,
  jobCardCreateFingerprint,
} from "../job-card-create-request.service.js";

const input = createJobCardSchema.parse({
  clientRequestId: "11111111-1111-4111-8111-111111111111",
  branchId: "branch",
  vehicleId: "truck",
  driverId: "driver",
  truckStatus: "AT_HO",
  inDateTime: "2026-11-13T08:00:00Z",
  openingKm: 100,
  serviceLines: [
    {
      serviceProviderId: "provider",
      sparePartId: "part",
      qty: 2,
      ratePaise: "9007199254740993",
    },
  ],
});
const fixture = () => {
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    jobCard: { findUnique: vi.fn().mockResolvedValue(null) },
  };
  return { tx, db: tx as unknown as Prisma.TransactionClient };
};

describe("job card create-request safety", () => {
  it("requires valid request UUIDs for both create actions, without changing edit contracts", () => {
    expect(
      createJobCardSchema.safeParse({ ...input, clientRequestId: undefined })
        .success,
    ).toBe(false);
    expect(
      createAndFinaliseJobCardSchema.safeParse({
        ...input,
        clientRequestId: "invalid",
        outDateTime: "2026-11-13T09:00:00Z",
        closingKm: 110,
      }).success,
    ).toBe(false);
    expect(
      updateJobCardSchema.safeParse({ ...input, clientRequestId: undefined })
        .success,
    ).toBe(true);
  });
  it("fingerprints exact bigints and binds the payload, user and action independently of object key ordering", () => {
    const fingerprint = jobCardCreateFingerprint(input, "user", "DRAFT");
    expect(
      jobCardCreateFingerprint(
        {
          ...input,
          serviceLines: [
            { ...input.serviceLines[0]!, ratePaise: 9007199254740994n },
          ],
        },
        "user",
        "DRAFT",
      ),
    ).not.toBe(fingerprint);
    expect(jobCardCreateFingerprint(input, "other-user", "DRAFT")).not.toBe(
      fingerprint,
    );
    expect(jobCardCreateFingerprint(input, "user", "FINALISE")).not.toBe(
      fingerprint,
    );
    expect(
      jobCardCreateFingerprint(
        Object.fromEntries(Object.entries(input).reverse()) as typeof input,
        "user",
        "DRAFT",
      ),
    ).toBe(fingerprint);
  });
  it.each(["DRAFT", "FINALISE"] as const)(
    "serialises and replays a %s request without executing creation or finalisation again",
    async (action) => {
      const { tx, db } = fixture();
      const create = vi.fn().mockImplementation(async (identity) => {
        tx.jobCard.findUnique.mockResolvedValue({
          id: "original",
          branchId: input.branchId,
          createdById: "user",
          ...identity,
        });
        return { id: "original" };
      });
      await expect(
        createJobCardOnceTx(db, input, "user", action, create),
      ).resolves.toEqual({ id: "original" });
      await expect(
        createJobCardOnceTx(db, input, "user", action, create),
      ).resolves.toEqual({ id: "original" });
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith({
        clientRequestId: input.clientRequestId,
        requestFingerprint: jobCardCreateFingerprint(input, "user", action),
      });
      expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
        tx.jobCard.findUnique.mock.invocationCallOrder[0]!,
      );
      expect(tx.$executeRaw.mock.calls[0]![1]).toBe(
        `job-card-create:${input.clientRequestId}`,
      );
    },
  );
  it("rejects changed payloads and action switches before any callback effects", async () => {
    const { tx, db } = fixture();
    tx.jobCard.findUnique.mockResolvedValue({
      id: "original",
      branchId: input.branchId,
      createdById: "user",
      requestFingerprint: jobCardCreateFingerprint(input, "user", "DRAFT"),
    });
    const create = vi.fn();
    await expect(
      createJobCardOnceTx(
        db,
        { ...input, openingKm: 101 },
        "user",
        "DRAFT",
        create,
      ),
    ).rejects.toThrow("already used");
    await expect(
      createJobCardOnceTx(db, input, "user", "FINALISE", create),
    ).rejects.toThrow("already used");
    expect(create).not.toHaveBeenCalled();
  });
  it("does not disclose or replay a card moved to another branch or owned by another creator", async () => {
    const { tx, db } = fixture();
    const original = {
      id: "original",
      branchId: input.branchId,
      createdById: "user",
      requestFingerprint: jobCardCreateFingerprint(input, "user", "DRAFT"),
    };
    const create = vi.fn();
    tx.jobCard.findUnique
      .mockResolvedValueOnce({ ...original, branchId: "other" })
      .mockResolvedValueOnce({ ...original, createdById: "other-user" });
    await expect(
      createJobCardOnceTx(db, input, "user", "DRAFT", create),
    ).rejects.toThrow("already used");
    await expect(
      createJobCardOnceTx(db, input, "user", "DRAFT", create),
    ).rejects.toThrow("already used");
    expect(create).not.toHaveBeenCalled();
  });
  it("propagates transaction failures so creation, identity, stock and vouchers roll back together", async () => {
    const { db } = fixture();
    const create = vi.fn().mockRejectedValue(new Error("Posting failed"));
    await expect(
      createJobCardOnceTx(db, input, "user", "FINALISE", create),
    ).rejects.toThrow("Posting failed");
    expect(create).toHaveBeenCalledTimes(1);
  });
});
