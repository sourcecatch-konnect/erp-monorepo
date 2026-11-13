import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createVendorPaymentDisbursementSchema,
  reverseJobCardSettlementSchema,
} from "@skerp/validators";
import type { Prisma } from "../../../../generated/prisma/index.js";
import { reverseJobCardSettlementTx } from "../job-card-reversal.service.js";
import { reverseJournal } from "../../ledger/posting.service.js";
vi.mock("../../ledger/posting.service.js", () => ({
  reverseJournal: vi.fn().mockResolvedValue({ id: "reversal" }),
}));
const args = {
  paymentId: "payment",
  slipId: "slip",
  branchId: "branch",
  reason: "Wrong bank transfer",
};
function fixture() {
  const payment = {
    id: "payment",
    slipId: "slip",
    paidPaise: 800n,
    tdsPaise: 100n,
    fundingLedgerId: "bank",
    settlementJournalEntryId: "journal",
    reversedAt: null,
    reversalJournalEntryId: null,
  };
  const journal = {
    id: "journal",
    status: "POSTED",
    branchId: "branch",
    sourceId: "payment",
    sourceType: "VENDOR_PAYMENT",
    lines: [
      {
        ledgerId: "provider",
        debitPaise: 900n,
        creditPaise: 0n,
        ledger: {
          sparePartSupplierId: "provider",
          code: null,
          cashAccountId: null,
        },
      },
      {
        ledgerId: "bank",
        debitPaise: 0n,
        creditPaise: 800n,
        ledger: {
          sparePartSupplierId: null,
          code: null,
          cashAccountId: "cash",
        },
      },
      {
        ledgerId: "tds",
        debitPaise: 0n,
        creditPaise: 100n,
        ledger: {
          sparePartSupplierId: null,
          code: "TDS_PAYABLE",
          cashAccountId: null,
        },
      },
    ],
  };
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    vendorPaymentDisbursement: {
      findUnique: vi.fn().mockResolvedValue(payment),
      update: vi.fn().mockResolvedValue({}),
    },
    serviceBillPayment: {
      findUnique: vi
        .fn()
        .mockResolvedValue({
          ...payment,
          slipId: undefined,
          serviceBillId: "bill",
          journalEntryId: "journal",
          fromAccountId: "cash",
          fundingLedgerId: undefined,
        }),
      update: vi.fn().mockResolvedValue({}),
    },
    vendorPaymentSlip: {
      findUnique: vi
        .fn()
        .mockResolvedValue({
          id: "slip",
          branchId: "branch",
          type: "JOBCARD",
          status: "PAID",
          netPayablePaise: 900n,
          paidPaise: 900n,
          version: 3,
          serviceBillId: "bill",
        }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    serviceBill: {
      findUnique: vi
        .fn()
        .mockResolvedValue({
          id: "bill",
          branchId: "branch",
          serviceProviderId: "provider",
          status: "POSTED",
          netAmountPaise: 1000n,
          paidAmountPaise: 1000n,
          version: 4,
        }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    vendorPaymentSlipLine: { findFirst: vi.fn().mockResolvedValue(null) },
    journalEntry: { findUnique: vi.fn().mockResolvedValue(journal) },
  };
  return {
    tx,
    payment,
    journal,
    db: tx as unknown as Prisma.TransactionClient,
  };
}
beforeEach(() => vi.clearAllMocks());
describe("job card settlement reversal", () => {
  it("requires a reason and accepts positive withholding-only inputs", () => {
    expect(
      reverseJobCardSettlementSchema.safeParse({ reason: "  " }).success,
    ).toBe(false);
    const input = {
      paidPaise: "0",
      tdsPaise: "100",
      mode: "BANK",
      paidAt: "2026-11-13",
      fundingLedgerId: "bank",
      clientRequestId: "request",
    };
    expect(createVendorPaymentDisbursementSchema.safeParse(input).success).toBe(
      true,
    );
    expect(
      createVendorPaymentDisbursementSchema.safeParse({
        ...input,
        tdsPaise: "0",
      }).success,
    ).toBe(false);
    expect(
      createVendorPaymentDisbursementSchema.safeParse({
        ...input,
        paidPaise: "-1",
      }).success,
    ).toBe(false);
  });
  it("reverses cash plus TDS once and reopens the approved slip while retaining original payments", async () => {
    const { tx, db } = fixture();
    await reverseJobCardSettlementTx(db, args, "user");
    expect(reverseJournal).toHaveBeenCalledWith(
      db,
      "journal",
      args.reason,
      "user",
    );
    expect(tx.serviceBill.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          paidAmountPaise: { decrement: 900n },
          version: { increment: 1 },
        },
      }),
    );
    expect(tx.vendorPaymentSlip.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { paidPaise: 0n, status: "APPROVED", version: { increment: 1 } },
      }),
    );
    expect(tx.vendorPaymentDisbursement.update).toHaveBeenCalledWith({
      where: { id: "payment" },
      data: expect.objectContaining({
        reversedById: "user",
        reversalReason: args.reason,
        reversalJournalEntryId: "reversal",
      }),
    });
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.vendorPaymentDisbursement.findUnique.mock.invocationCallOrder[0]!,
    );
  });
  it("replays completed reversals without decrementing balances or creating another voucher", async () => {
    const { tx, payment, db } = fixture();
    tx.vendorPaymentDisbursement.findUnique.mockResolvedValue({
      ...payment,
      reversedAt: new Date(),
      reversalJournalEntryId: "existing",
    });
    expect(await reverseJobCardSettlementTx(db, args, "user")).toMatchObject({
      reversalJournalEntryId: "existing",
    });
    expect(tx.serviceBill.updateMany).not.toHaveBeenCalled();
    expect(reverseJournal).not.toHaveBeenCalled();
  });
  it("blocks wrong branch, slip identity and non-job-card sources", async () => {
    const { tx, db } = fixture();
    tx.vendorPaymentSlip.findUnique
      .mockResolvedValueOnce({
        id: "other",
        branchId: "branch",
        type: "JOBCARD",
      })
      .mockResolvedValueOnce({ id: "slip", branchId: "other", type: "JOBCARD" })
      .mockResolvedValueOnce({
        id: "slip",
        branchId: "branch",
        type: "HAMALI",
      });
    for (let i = 0; i < 3; i++)
      await expect(
        reverseJobCardSettlementTx(db, args, "user"),
      ).rejects.toThrow("not found");
    expect(reverseJournal).not.toHaveBeenCalled();
  });
  it("rejects stale bill claims and mismatched voucher amounts before reversal", async () => {
    const { tx, journal, db } = fixture();
    tx.serviceBill.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(reverseJobCardSettlementTx(db, args, "user")).rejects.toThrow(
      "Bill changed",
    );
    tx.journalEntry.findUnique.mockResolvedValueOnce({
      ...journal,
      lines: journal.lines.slice(1),
    });
    await expect(reverseJobCardSettlementTx(db, args, "user")).rejects.toThrow(
      "amounts do not reconcile",
    );
    expect(reverseJournal).not.toHaveBeenCalled();
  });
  it("rejects vouchers reversed outside the settlement workflow", async () => {
    const { tx, journal, db } = fixture();
    tx.journalEntry.findUnique.mockResolvedValueOnce({
      ...journal,
      status: "REVERSED",
    });
    await expect(reverseJobCardSettlementTx(db, args, "user")).rejects.toThrow(
      "does not match",
    );
    expect(reverseJournal).not.toHaveBeenCalled();
  });
  it("propagates posting failures and stale slip updates for transaction rollback", async () => {
    const { tx, db } = fixture();
    vi.mocked(reverseJournal).mockRejectedValueOnce(
      new Error("Posting failed"),
    );
    await expect(reverseJobCardSettlementTx(db, args, "user")).rejects.toThrow(
      "Posting failed",
    );
    expect(tx.vendorPaymentDisbursement.update).not.toHaveBeenCalled();
    tx.vendorPaymentSlip.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(reverseJobCardSettlementTx(db, args, "user")).rejects.toThrow(
      "Slip changed",
    );
  });
  it("requires active slip release before changing a historical direct settlement", async () => {
    const { tx, db } = fixture();
    tx.vendorPaymentSlipLine.findFirst.mockResolvedValue({ id: "active" });
    await expect(
      reverseJobCardSettlementTx(
        db,
        { ...args, slipId: undefined, billId: "bill" },
        "user",
      ),
    ).rejects.toThrow("Cancel the active payment slip");
    expect(reverseJournal).not.toHaveBeenCalled();
  });
  it("can reverse an unreserved legacy payment using its original cash-account journal", async () => {
    const { tx, payment, journal, db } = fixture();
    tx.serviceBillPayment.findUnique.mockResolvedValue({
      id: payment.id,
      serviceBillId: "bill",
      paidPaise: 800n,
      tdsPaise: 100n,
      fromAccountId: "cash",
      journalEntryId: "journal",
      reversedAt: null,
    });
    tx.journalEntry.findUnique.mockResolvedValue({
      ...journal,
      sourceType: "SERVICE_BILL",
    });
    await reverseJobCardSettlementTx(
      db,
      { ...args, slipId: undefined, billId: "bill" },
      "user",
    );
    expect(tx.serviceBillPayment.update).toHaveBeenCalled();
    expect(tx.vendorPaymentSlip.updateMany).not.toHaveBeenCalled();
  });
});
