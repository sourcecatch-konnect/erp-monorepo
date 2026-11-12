import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "../../../../generated/prisma/index.js";
import {
  createJobCardRemovedPartSchema,
  jobCardRemovedPartListQuerySchema,
} from "@skerp/validators";
import {
  createRemovedPartTx,
  removedPartFingerprint,
} from "../job-card-removed-part.service.js";
import { postPartReturnVoucher } from "../../ledger/posting.service.js";

vi.mock("../../ledger/posting.service.js", () => ({
  postPartReturnVoucher: vi.fn().mockResolvedValue({ id: "voucher" }),
}));
vi.mock("../../_shared/doc-number.js", () => ({
  fyCodeFor: () => "26-27",
  nextSequence: vi.fn().mockResolvedValue(1),
  formatDocNumber: () => "JCRP/HO/1",
}));
const rawInput = {
  clientRequestId: "45c808c6-93b8-456d-941e-f42644050fff",
  sparePartId: "part",
  qty: 2,
  condition: "REUSABLE",
  unitCostPaise: "200",
};
const input = () => createJobCardRemovedPartSchema.parse(rawInput);

function fixture() {
  const tx = {
    jobCard: {
      findUnique: vi
        .fn()
        .mockResolvedValue({
          id: "card",
          branchId: "ho",
          status: "FINALISED",
          version: 2,
        }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    jobCardRemovedPart: {
      findUnique: vi.fn().mockResolvedValue(null),
      aggregate: vi.fn().mockResolvedValue({ _sum: { qty: 0 } }),
      create: vi.fn().mockResolvedValue({ id: "removed" }),
      update: vi.fn().mockResolvedValue({ id: "removed" }),
    },
    jobCardPartLine: {
      findUnique: vi
        .fn()
        .mockResolvedValue({
          id: "issue",
          jobCardId: "card",
          sparePartId: "part",
          qty: 3,
          unitCostPaise: 300n,
          batchId: "original",
        }),
    },
    sparePart: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ supplierId: "supplier", type: "Item" }),
    },
    spareBatch: {
      findUnique: vi.fn().mockResolvedValue({ supplierId: "supplier" }),
      create: vi.fn().mockResolvedValue({ id: "return-batch" }),
    },
    stockLedger: {
      upsert: vi
        .fn()
        .mockResolvedValue({ currentQty: 3, movingAvgCostPaise: 100n }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    stockMovement: { create: vi.fn().mockResolvedValue({}) },
    branch: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ branchCode: "HO" }),
    },
  };
  return { tx, db: tx as unknown as Prisma.TransactionClient };
}
beforeEach(() => vi.clearAllMocks());

describe("removed-part input", () => {
  it("requires a valid request identity and a value source for reusable returns", () => {
    expect(
      createJobCardRemovedPartSchema.safeParse({
        ...rawInput,
        clientRequestId: undefined,
      }).success,
    ).toBe(false);
    expect(
      createJobCardRemovedPartSchema.safeParse({
        ...rawInput,
        unitCostPaise: undefined,
      }).success,
    ).toBe(false);
    expect(
      createJobCardRemovedPartSchema.safeParse({
        ...rawInput,
        unitCostPaise: undefined,
        relatedPartLineId: "issue",
      }).success,
    ).toBe(true);
  });
  it("bounds backend pages and trims search", () => {
    expect(
      jobCardRemovedPartListQuerySchema.parse({ page: "2", search: " part " }),
    ).toMatchObject({ page: 2, size: 10, search: "part" });
    expect(
      jobCardRemovedPartListQuerySchema.safeParse({ size: 101 }).success,
    ).toBe(false);
  });
});

describe("removed-part service", () => {
  it("returns a matching prior result without moving stock or posting again", async () => {
    const { tx, db } = fixture();
    tx.jobCardRemovedPart.findUnique.mockResolvedValue({
      id: "prior",
      jobCardId: "card",
      requestFingerprint: removedPartFingerprint("card", input()),
    });
    await expect(
      createRemovedPartTx(db, "card", "ho", input(), "user"),
    ).resolves.toEqual({ id: "prior" });
    expect(tx.jobCard.updateMany).not.toHaveBeenCalled();
    expect(tx.spareBatch.create).not.toHaveBeenCalled();
    expect(postPartReturnVoucher).not.toHaveBeenCalled();
  });
  it("binds the request key to the original card and payload", async () => {
    const { tx, db } = fixture();
    tx.jobCardRemovedPart.findUnique.mockResolvedValue({
      id: "prior",
      jobCardId: "card",
      requestFingerprint: removedPartFingerprint("card", {
        ...input(),
        qty: 1,
      }),
    });
    await expect(
      createRemovedPartTx(db, "card", "ho", input(), "user"),
    ).rejects.toThrow("different removed-part entry");
  });
  it.each(["DRAFT", "CANCELLED"])(
    "rejects %s cards without creating inventory",
    async (status) => {
      const { tx, db } = fixture();
      tx.jobCard.findUnique.mockResolvedValue({
        branchId: "ho",
        status,
        version: 1,
      });
      await expect(
        createRemovedPartTx(db, "card", "ho", input(), "user"),
      ).rejects.toThrow("FINALISED");
      expect(tx.spareBatch.create).not.toHaveBeenCalled();
    },
  );
  it("rejects branch mismatch and a lost parent claim", async () => {
    const { tx, db } = fixture();
    await expect(
      createRemovedPartTx(db, "card", "other", input(), "user"),
    ).rejects.toThrow("not found");
    tx.jobCard.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      createRemovedPartTx(db, "card", "ho", input(), "user"),
    ).rejects.toThrow("Job card changed");
    expect(tx.jobCardRemovedPart.create).not.toHaveBeenCalled();
  });
  it("returns a concurrently committed identical request after a failed parent claim", async () => {
    const { tx, db } = fixture();
    tx.jobCard.updateMany.mockResolvedValue({ count: 0 });
    tx.jobCardRemovedPart.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "prior",
        jobCardId: "card",
        requestFingerprint: removedPartFingerprint("card", input()),
      });
    await expect(
      createRemovedPartTx(db, "card", "ho", input(), "user"),
    ).resolves.toEqual({ id: "prior" });
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });
  it("caps the cumulative quantity on linked issue lines", async () => {
    const { tx, db } = fixture();
    tx.jobCardRemovedPart.aggregate.mockResolvedValue({ _sum: { qty: 2 } });
    await expect(
      createRemovedPartTx(
        db,
        "card",
        "ho",
        { ...input(), relatedPartLineId: "issue" },
        "user",
      ),
    ).rejects.toThrow("remaining quantity");
    expect(tx.spareBatch.create).not.toHaveBeenCalled();
  });
  it("rejects foreign issue lines and service masters", async () => {
    const { tx, db } = fixture();
    tx.jobCardPartLine.findUnique.mockResolvedValueOnce({
      jobCardId: "other",
      sparePartId: "part",
    });
    await expect(
      createRemovedPartTx(
        db,
        "card",
        "ho",
        { ...input(), relatedPartLineId: "issue" },
        "user",
      ),
    ).rejects.toThrow("must match");
    tx.sparePart.findUnique.mockResolvedValueOnce({ type: "Service" });
    await expect(
      createRemovedPartTx(db, "card", "ho", input(), "user"),
    ).rejects.toThrow("not a service");
  });
  it("returns reusable stock once, recalculates average, and posts the expense credit", async () => {
    const { tx, db } = fixture();
    await createRemovedPartTx(db, "card", "ho", input(), "user");
    expect(tx.stockLedger.updateMany).toHaveBeenCalledWith({
      where: {
        sparePartId: "part",
        branchId: "ho",
        currentQty: 3,
        movingAvgCostPaise: 100n,
      },
      data: { currentQty: { increment: 2 }, movingAvgCostPaise: 140n },
    });
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        qtyDelta: 2,
        balanceQtyAfter: 5,
        unitCostPaise: 200n,
      }),
    });
    expect(postPartReturnVoucher).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ amountPaise: 400n }),
    );
  });
  it("uses linked issue cost only when no explicit return cost was entered", async () => {
    const { db } = fixture();
    await createRemovedPartTx(
      db,
      "card",
      "ho",
      { ...input(), relatedPartLineId: "issue", unitCostPaise: undefined },
      "user",
    );
    expect(postPartReturnVoucher).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ amountPaise: 600n }),
    );
  });
  it.each(["REPAIRABLE", "SCRAP"] as const)(
    "records %s without usable stock or GL effects",
    async (condition) => {
      const { tx, db } = fixture();
      await createRemovedPartTx(
        db,
        "card",
        "ho",
        { ...input(), condition },
        "user",
      );
      expect(tx.jobCardRemovedPart.create).toHaveBeenCalled();
      expect(tx.stockLedger.upsert).not.toHaveBeenCalled();
      expect(tx.spareBatch.create).not.toHaveBeenCalled();
      expect(postPartReturnVoucher).not.toHaveBeenCalled();
    },
  );
  it("rejects changed stock without posting and propagates posting errors for rollback", async () => {
    const { tx, db } = fixture();
    tx.stockLedger.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      createRemovedPartTx(db, "card", "ho", input(), "user"),
    ).rejects.toThrow("Stock changed");
    expect(postPartReturnVoucher).not.toHaveBeenCalled();
    vi.mocked(postPartReturnVoucher).mockRejectedValueOnce(
      new Error("Posting unavailable"),
    );
    await expect(
      createRemovedPartTx(db, "card", "ho", input(), "user"),
    ).rejects.toThrow("Posting unavailable");
    expect(tx.jobCardRemovedPart.update).not.toHaveBeenCalled();
  });
});
