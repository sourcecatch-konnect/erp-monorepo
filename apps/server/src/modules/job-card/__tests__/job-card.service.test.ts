import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "../../../../generated/prisma/index.js";
import {
  finaliseJobCardTx,
  type FinaliseJobCard,
} from "../job-card.service.js";
import { postJobCardPartsVoucher } from "../../ledger/posting.service.js";

vi.mock("../../ledger/posting.service.js", () => ({
  postJobCardPartsVoucher: vi.fn().mockResolvedValue({ id: "voucher-1" }),
}));

const input = { outDateTime: new Date("2026-11-12T10:00:00Z"), closingKm: 110 };
const card = (): FinaliseJobCard => ({
  id: "jc-1",
  version: 1,
  jobCardNumber: "JC/1",
  branchId: "ho",
  fyCode: "2627",
  openingKm: 100,
  inDateTime: new Date("2026-11-12T09:00:00Z"),
  partLines: [
    { id: "line-1", sparePartId: "part-1", batchId: "batch-1", qty: 2 },
  ],
  serviceLines: [{ amountPaise: 1000n }],
});

function fixture(stock = 5) {
  let version = 1;
  let remaining = stock;
  let branchQty = stock;
  const batch = {
    id: "batch-1",
    branchId: "ho",
    sparePartId: "part-1",
    qtyRemaining: stock,
    unitCostPaise: 200n,
    batchNo: "B1",
  };
  const tx = {
    jobCard: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ repairControlRequired: false, repairControl: null }),
      updateMany: vi
        .fn()
        .mockImplementation(
          async ({ where }: { where: { version: number } }) => {
            if (where.version !== version) return { count: 0 };
            version += 1;
            return { count: 1 };
          },
        ),
      update: vi.fn().mockResolvedValue({ id: "jc-1" }),
    },
    spareBatch: {
      findMany: vi.fn().mockResolvedValue([batch]),
      updateMany: vi
        .fn()
        .mockImplementation(
          async ({
            data,
          }: {
            data: { qtyRemaining: { decrement: number } };
          }) => {
            const qty = data.qtyRemaining.decrement;
            if (remaining < qty) return { count: 0 };
            remaining -= qty;
            return { count: 1 };
          },
        ),
    },
    stockLedger: {
      updateMany: vi
        .fn()
        .mockImplementation(
          async ({ data }: { data: { currentQty: { decrement: number } } }) => {
            const qty = data.currentQty.decrement;
            if (branchQty < qty) return { count: 0 };
            branchQty -= qty;
            return { count: 1 };
          },
        ),
      findUniqueOrThrow: vi
        .fn()
        .mockImplementation(async () => ({ currentQty: branchQty })),
    },
    jobCardPartLine: { update: vi.fn().mockResolvedValue({}) },
    stockMovement: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  return {
    tx,
    run: (job = card(), completion = input) =>
      finaliseJobCardTx(
        tx as unknown as Prisma.TransactionClient,
        job,
        completion,
        "user-1",
      ),
  };
}

beforeEach(() => vi.clearAllMocks());

describe("job card finalisation service", () => {
  it("rejects invalid completion dates and KM before claiming stock", async () => {
    const { tx, run } = fixture();
    await expect(run(card(), { ...input, closingKm: 99 })).rejects.toThrow(
      "Closing KM",
    );
    await expect(
      run(card(), { ...input, outDateTime: new Date("2026-11-12T08:00:00Z") }),
    ).rejects.toThrow("Out date/time");
    await expect(
      run({ ...card(), partLines: [], serviceLines: [] }),
    ).rejects.toThrow("at least one");
    expect(tx.jobCard.updateMany).not.toHaveBeenCalled();
  });

  it("rejects combined demand that exceeds a batch even if individual lines fit", async () => {
    const { tx, run } = fixture(3);
    const job = card();
    job.partLines.push({ ...job.partLines[0]!, id: "line-2" });
    await expect(run(job)).rejects.toThrow("Insufficient stock");
    expect(tx.spareBatch.updateMany).toHaveBeenCalledWith({
      where: { id: "batch-1", branchId: "ho", qtyRemaining: { gte: 4 } },
      data: { qtyRemaining: { decrement: 4 } },
    });
    expect(postJobCardPartsVoucher).not.toHaveBeenCalled();
    expect(tx.stockMovement.createMany).not.toHaveBeenCalled();
  });

  it("issues repeated batch lines once and records running balances and costs", async () => {
    const { tx, run } = fixture();
    const job = card();
    job.partLines.push({ ...job.partLines[0]!, id: "line-2" });
    await run(job);
    expect(tx.spareBatch.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.stockLedger.updateMany).toHaveBeenCalledWith({
      where: { sparePartId: "part-1", branchId: "ho", currentQty: { gte: 4 } },
      data: { currentQty: { decrement: 4 } },
    });
    const movements = tx.stockMovement.createMany.mock.calls[0]![0].data;
    expect(
      movements.map(
        (movement: { balanceQtyAfter: number }) => movement.balanceQtyAfter,
      ),
    ).toEqual([3, 1]);
    expect(tx.jobCard.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalPartsAmountPaise: 800n,
          totalServiceAmountPaise: 1000n,
          totalAmountPaise: 1800n,
        }),
      }),
    );
    expect(postJobCardPartsVoucher).toHaveBeenCalledTimes(1);
  });

  it("stops a stale or duplicate finalise before issuing more stock", async () => {
    const { tx, run } = fixture();
    await run();
    await expect(run()).rejects.toThrow("Job card changed");
    expect(tx.spareBatch.updateMany).toHaveBeenCalledTimes(1);
    expect(postJobCardPartsVoucher).toHaveBeenCalledTimes(1);
  });

  it("rejects batches from a different branch or spare part", async () => {
    const { tx, run } = fixture();
    tx.spareBatch.findMany.mockResolvedValue([]);
    await expect(run()).rejects.toThrow("another branch");
    expect(tx.spareBatch.updateMany).not.toHaveBeenCalled();
    tx.spareBatch.findMany.mockResolvedValue([
      { sparePartId: "different-part" },
    ]);
    await expect(run({ ...card(), version: 2 })).rejects.toThrow(
      "batch is invalid",
    );
  });

  it("rejects missing or insufficient branch stock without posting", async () => {
    const { tx, run } = fixture();
    tx.stockLedger.updateMany.mockResolvedValue({ count: 0 });
    await expect(run()).rejects.toThrow("Branch stock");
    expect(postJobCardPartsVoucher).not.toHaveBeenCalled();
  });

  it("finalises services-only jobs without inventory or expense posting", async () => {
    const { tx, run } = fixture();
    await run({ ...card(), partLines: [] });
    expect(tx.spareBatch.updateMany).not.toHaveBeenCalled();
    expect(tx.stockLedger.updateMany).not.toHaveBeenCalled();
    expect(postJobCardPartsVoucher).not.toHaveBeenCalled();
    expect(tx.jobCard.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FINALISED",
          journalEntryId: null,
          totalAmountPaise: 1000n,
        }),
      }),
    );
  });

  it("propagates posting failure so the caller's transaction rolls back", async () => {
    const { tx, run } = fixture();
    vi.mocked(postJobCardPartsVoucher).mockRejectedValueOnce(
      new Error("GL unavailable"),
    );
    await expect(run()).rejects.toThrow("GL unavailable");
    expect(tx.jobCard.update).not.toHaveBeenCalled();
  });
});
