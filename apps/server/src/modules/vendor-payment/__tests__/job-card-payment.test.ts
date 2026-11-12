import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "../../../../generated/prisma/index.js";
import { createVendorPaymentDisbursementSchema } from "@skerp/validators";
import {
  assertJobCardSlipBalance,
  createJobCardPaymentSlipTx,
  settleJobCardBillTx,
} from "../job-card-payment.service.js";

vi.mock("../../_shared/doc-number.js", () => ({
  fyCodeFor: () => "26-27",
  nextSequence: vi.fn().mockResolvedValue(1),
  formatDocNumber: () => "VPAY/HO/1",
}));
const slip = { serviceBillId: "bill", netPayablePaise: 900n, paidPaise: 0n };
function fixture() {
  const bill = {
    id: "bill",
    branchId: "ho",
    serviceProviderId: "provider",
    status: "POSTED",
    version: 1,
    netAmountPaise: 1000n,
    paidAmountPaise: 100n,
    branch: { branchCode: "HO" },
  };
  const tx = {
    serviceBill: {
      findUnique: vi.fn().mockResolvedValue(bill),
      findUniqueOrThrow: vi.fn().mockResolvedValue(bill),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    vendorPaymentSlipLine: { findFirst: vi.fn().mockResolvedValue(null) },
    vendorPaymentSlip: { create: vi.fn().mockResolvedValue({ id: "slip" }) },
  };
  return { tx, bill, db: tx as unknown as Prisma.TransactionClient };
}
beforeEach(() => vi.clearAllMocks());

describe("job card payment reservation", () => {
  it("reserves the server-calculated remaining bill balance and makes no accrual", async () => {
    const { tx, db } = fixture();
    await createJobCardPaymentSlipTx(db, "bill", "ho", "maker");
    expect(tx.vendorPaymentSlip.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "JOBCARD",
          serviceBillId: "bill",
          status: "DRAFT",
          netPayablePaise: 900n,
          lines: {
            create: {
              sourceType: "SERVICE_BILL",
              sourceId: "bill",
              freightPaise: 900n,
              netPaise: 900n,
            },
          },
        }),
      }),
    );
  });
  it("returns an active slip on retried preparation instead of duplicating it", async () => {
    const { tx, db } = fixture();
    tx.vendorPaymentSlipLine.findFirst.mockResolvedValue({ slipId: "active" });
    await expect(
      createJobCardPaymentSlipTx(db, "bill", "ho", "maker"),
    ).resolves.toEqual({ id: "active" });
    expect(tx.vendorPaymentSlip.create).not.toHaveBeenCalled();
  });
  it("rejects branch mismatch, a changed/cancelled bill and settled bills", async () => {
    const { tx, bill, db } = fixture();
    await expect(
      createJobCardPaymentSlipTx(db, "bill", "foreign", "maker"),
    ).rejects.toThrow("not found");
    tx.serviceBill.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      createJobCardPaymentSlipTx(db, "bill", "ho", "maker"),
    ).rejects.toThrow("Bill changed");
    tx.serviceBill.findUnique.mockResolvedValue({
      ...bill,
      paidAmountPaise: 1000n,
    });
    await expect(
      createJobCardPaymentSlipTx(db, "bill", "ho", "maker"),
    ).rejects.toThrow("already settled");
  });
  it("rejects a missing/cancelled bill or a mismatched remaining balance", async () => {
    const { tx, bill, db } = fixture();
    await expect(
      assertJobCardSlipBalance(db, { ...slip, serviceBillId: null }),
    ).rejects.toThrow("no service bill");
    tx.serviceBill.findUnique.mockResolvedValueOnce(null);
    await expect(assertJobCardSlipBalance(db, slip)).rejects.toThrow(
      "balance changed",
    );
    tx.serviceBill.findUnique.mockResolvedValueOnce({
      ...bill,
      status: "CANCELLED",
    });
    await expect(assertJobCardSlipBalance(db, slip)).rejects.toThrow(
      "balance changed",
    );
    await expect(
      assertJobCardSlipBalance(db, { ...slip, paidPaise: 100n }),
    ).rejects.toThrow("balance changed");
  });
  it("settles cash plus TDS through a conditional bill update", async () => {
    const { tx, db } = fixture();
    await settleJobCardBillTx(db, slip, 800n, 100n);
    expect(tx.serviceBill.updateMany).toHaveBeenCalledWith({
      where: {
        id: "bill",
        status: "POSTED",
        version: 1,
        paidAmountPaise: 100n,
      },
      data: { version: { increment: 1 }, paidAmountPaise: { increment: 900n } },
    });
  });
  it("rejects overpayment and a cancellation/payment that wins the version race", async () => {
    const { tx, db } = fixture();
    await expect(settleJobCardBillTx(db, slip, 850n, 100n)).rejects.toThrow(
      "pending amount",
    );
    tx.serviceBill.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(settleJobCardBillTx(db, slip, 100n, 0n)).rejects.toThrow(
      "during payment",
    );
  });
  it("defaults settlement TDS to zero and rejects negative TDS", () => {
    const input = {
      paidPaise: "800",
      mode: "BANK",
      paidAt: "2026-11-12",
      fundingLedgerId: "bank",
      clientRequestId: "request",
    };
    expect(createVendorPaymentDisbursementSchema.parse(input).tdsPaise).toBe(
      0n,
    );
    expect(
      createVendorPaymentDisbursementSchema.safeParse({
        ...input,
        tdsPaise: "-1",
      }).success,
    ).toBe(false);
  });
});
