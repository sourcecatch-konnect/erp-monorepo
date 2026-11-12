import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "../../../../generated/prisma/index.js";
import {
  createServiceBillSchema,
  unbilledServiceLinesQuerySchema,
} from "@skerp/validators";
import {
  createServiceBillTx,
  cancelServiceBillTx,
  reserveServiceBillPaymentTx,
} from "../service-bill.service.js";
import {
  postServiceBillVoucher,
  reverseJournal,
} from "../../ledger/posting.service.js";

vi.mock("../../ledger/posting.service.js", () => ({
  postServiceBillVoucher: vi.fn().mockResolvedValue({ id: "voucher" }),
  reverseJournal: vi.fn().mockResolvedValue({}),
}));
vi.mock("../../_shared/doc-number.js", () => ({
  fyCodeFor: () => "26-27",
  nextSequence: vi.fn().mockResolvedValue(1),
  formatDocNumber: () => "SB/HO/1",
}));

const rawInput = {
  branchId: "ho",
  serviceProviderId: "provider",
  billDate: "2026-11-12",
  providerInvoiceNo: "INV-1",
  jobCardServiceLineIds: ["line"],
};
const line = () => ({
  id: "line",
  sparePartId: "part",
  serviceProviderId: "provider",
  billedInServiceBillId: null as string | null,
  qty: 2,
  ratePaise: 500n,
  amountPaise: 1000n,
  description: "Repair",
  sparePart: { id: "part", name: "Welding" },
  jobCard: {
    id: "card",
    branchId: "ho",
    status: "FINALISED",
    version: 2,
    jobCardNumber: "JC/1",
    vehicleId: "truck",
    finalisedAt: new Date("2026-11-12T09:00:00Z"),
  },
});
const bill = { id: "bill", version: 1, journalEntryId: "voucher" };

function fixture() {
  const tx = {
    vendorPaymentSlipLine: { findMany: vi.fn().mockResolvedValue([]) },
    jobCardServiceLine: {
      findMany: vi.fn().mockResolvedValue([line()]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    jobCard: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    serviceBill: {
      create: vi.fn().mockResolvedValue({ id: "bill" }),
      update: vi.fn().mockResolvedValue({ id: "bill" }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi
        .fn()
        .mockResolvedValue({
          id: "bill",
          version: 1,
          status: "POSTED",
          netAmountPaise: 1000n,
          paidAmountPaise: 0n,
        }),
    },
    serviceBillLine: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    serviceBillPayment: { count: vi.fn().mockResolvedValue(0) },
  };
  return { tx, db: tx as unknown as Prisma.TransactionClient };
}
beforeEach(() => vi.clearAllMocks());

describe("service billing input", () => {
  it("rejects duplicate selections and oversized bills", () => {
    expect(
      createServiceBillSchema.safeParse({
        ...rawInput,
        jobCardServiceLineIds: ["line", "line"],
      }).success,
    ).toBe(false);
    expect(
      createServiceBillSchema.safeParse({
        ...rawInput,
        jobCardServiceLineIds: Array.from({ length: 501 }, (_, i) => String(i)),
      }).success,
    ).toBe(false);
  });
  it("bounds eligible-service queries and trims backend search", () => {
    expect(
      unbilledServiceLinesQuerySchema.parse({
        serviceProviderId: "provider",
        page: "2",
        search: " JC ",
      }),
    ).toMatchObject({ page: 2, size: 20, search: "JC" });
    expect(
      unbilledServiceLinesQuerySchema.safeParse({
        serviceProviderId: "provider",
        size: 101,
      }).success,
    ).toBe(false);
  });
});

describe("create service bill", () => {
  it.each(["branch", "provider", "draft", "billed", "missing"])(
    "rejects %s mismatches before posting",
    async (invalid) => {
      const { tx, db } = fixture();
      const service = line();
      if (invalid === "branch") service.jobCard.branchId = "other";
      if (invalid === "provider") service.serviceProviderId = "other";
      if (invalid === "draft") service.jobCard.status = "DRAFT";
      if (invalid === "billed") service.billedInServiceBillId = "old-bill";
      tx.jobCardServiceLine.findMany.mockResolvedValue(
        invalid === "missing" ? [] : [service],
      );
      await expect(
        createServiceBillTx(
          db,
          createServiceBillSchema.parse(rawInput),
          "HO",
          "user",
        ),
      ).rejects.toThrow();
      expect(tx.serviceBill.create).not.toHaveBeenCalled();
      expect(postServiceBillVoucher).not.toHaveBeenCalled();
    },
  );
  it("rejects a changed job card or a concurrent line claim", async () => {
    const { tx, db } = fixture();
    tx.jobCard.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      createServiceBillTx(
        db,
        createServiceBillSchema.parse(rawInput),
        "HO",
        "user",
      ),
    ).rejects.toThrow("job card changed");
    tx.jobCardServiceLine.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      createServiceBillTx(
        db,
        createServiceBillSchema.parse(rawInput),
        "HO",
        "user",
      ),
    ).rejects.toThrow("another user");
    expect(tx.serviceBillLine.createMany).not.toHaveBeenCalled();
    expect(postServiceBillVoucher).not.toHaveBeenCalled();
  });
  it("snapshots source details and posts only net service expense", async () => {
    const { tx, db } = fixture();
    await createServiceBillTx(
      db,
      createServiceBillSchema.parse({ ...rawInput, discountPaise: "100" }),
      "HO",
      "user",
    );
    expect(tx.serviceBillLine.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          amountPaise: 1000n,
          serviceSnapshot: expect.objectContaining({
            ratePaise: "500",
            qty: 2,
            jobCard: expect.objectContaining({ vehicleId: "truck" }),
          }),
        }),
      ],
    });
    expect(postServiceBillVoucher).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ netAmountPaise: 900n }),
    );
  });
  it("rejects excessive discounts", async () => {
    const { tx, db } = fixture();
    await expect(
      createServiceBillTx(
        db,
        createServiceBillSchema.parse({ ...rawInput, discountPaise: "1001" }),
        "HO",
        "user",
      ),
    ).rejects.toThrow("Discount");
    expect(tx.serviceBill.create).not.toHaveBeenCalled();
  });
});

describe("cancel service bill", () => {
  it("releases active source claims and reverses the journal without deleting historical lines", async () => {
    const { tx, db } = fixture();
    await cancelServiceBillTx(db, bill, "Wrong invoice", "user");
    expect(tx.jobCardServiceLine.updateMany).toHaveBeenCalledWith({
      where: { billedInServiceBillId: "bill" },
      data: { billedInServiceBillId: null },
    });
    expect(reverseJournal).toHaveBeenCalledWith(
      db,
      "voucher",
      "Wrong invoice",
      "user",
    );
    expect(tx.serviceBillLine.createMany).not.toHaveBeenCalled();
  });
  it("rejects stale transitions or bills with payment history before releasing services", async () => {
    const { tx, db } = fixture();
    tx.serviceBill.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      cancelServiceBillTx(db, bill, "Wrong invoice", "user"),
    ).rejects.toThrow("Bill changed");
    tx.serviceBillPayment.count.mockResolvedValueOnce(1);
    await expect(
      cancelServiceBillTx(db, bill, "Wrong invoice", "user"),
    ).rejects.toThrow("with payments");
    expect(tx.jobCardServiceLine.updateMany).not.toHaveBeenCalled();
    expect(reverseJournal).not.toHaveBeenCalled();
  });
});

describe("reserve service settlement", () => {
  it("claims cash plus TDS atomically against bill status and version", async () => {
    const { tx, db } = fixture();
    await reserveServiceBillPaymentTx(db, "bill", 900n);
    expect(tx.serviceBill.updateMany).toHaveBeenCalledWith({
      where: { id: "bill", status: "POSTED", version: 1, paidAmountPaise: 0n },
      data: { version: { increment: 1 }, paidAmountPaise: { increment: 900n } },
    });
  });
  it("rejects cancelled, overpaid and concurrently modified bills", async () => {
    const { tx, db } = fixture();
    tx.serviceBill.findUniqueOrThrow.mockResolvedValueOnce({
      status: "CANCELLED",
    });
    await expect(reserveServiceBillPaymentTx(db, "bill", 100n)).rejects.toThrow(
      "POSTED",
    );
    await expect(
      reserveServiceBillPaymentTx(db, "bill", 1001n),
    ).rejects.toThrow("pending");
    tx.serviceBill.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(reserveServiceBillPaymentTx(db, "bill", 500n)).rejects.toThrow(
      "during payment",
    );
  });
});
