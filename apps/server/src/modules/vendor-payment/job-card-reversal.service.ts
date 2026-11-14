import type { Prisma } from "../../../generated/prisma/index.js";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../lib/error.js";
import { reverseJournal } from "../ledger/posting.service.js";
import { assertJobCardSlipBalance } from "./job-card-payment.service.js";

type Tx = Prisma.TransactionClient;

/** Caller checks branch/permission; transaction must use READ COMMITTED. */
export async function reverseJobCardSettlementTx(
  tx: Tx,
  input: {
    paymentId: string;
    branchId: string;
    slipId?: string;
    billId?: string;
    reason: string;
  },
  actorId: string,
) {
  const shared = Boolean(input.slipId);
  const lock = shared
    ? `vendor-payment-slip:${input.slipId}`
    : `legacy-service-payment:${input.paymentId}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lock}))`;
  const payment = shared
    ? await tx.vendorPaymentDisbursement.findUnique({
        where: { id: input.paymentId },
      })
    : await tx.serviceBillPayment.findUnique({
        where: { id: input.paymentId },
      });
  if (!payment) throw new NotFoundError("Settlement not found");
  const slip = shared
    ? await tx.vendorPaymentSlip.findUnique({ where: { id: input.slipId! } })
    : null;
  if (
    shared &&
    (!slip ||
      slip.type !== "JOBCARD" ||
      !("slipId" in payment) ||
      payment.slipId !== slip.id ||
      slip.branchId !== input.branchId)
  )
    throw new NotFoundError("Job card settlement not found");
  const billId = slip?.serviceBillId ?? input.billId;
  if (
    !billId ||
    (!shared &&
      (!("serviceBillId" in payment) || payment.serviceBillId !== billId))
  )
    throw new NotFoundError("Settlement not found");
  const bill = await tx.serviceBill.findUnique({ where: { id: billId } });
  if (!bill || bill.branchId !== input.branchId)
    throw new NotFoundError("Service bill not found");
  // Natural payment identity makes retrying a completed reversal a no-op.
  if (payment.reversedAt)
    return {
      billId,
      slipId: slip?.id,
      reversalJournalEntryId: payment.reversalJournalEntryId,
    };
  if (bill.status !== "POSTED")
    throw new ConflictError("Only posted bill settlements can be reversed");
  const amount = payment.paidPaise + payment.tdsPaise;
  if (amount <= 0n || bill.paidAmountPaise < amount)
    throw new ConflictError("Settlement balance requires reconciliation");
  if (slip) {
    if (
      !["PAID", "PARTIALLY_PAID"].includes(slip.status) ||
      slip.paidPaise < amount
    )
      throw new ConflictError("Slip balance requires reconciliation");
    await assertJobCardSlipBalance(tx, slip);
  }
  const claimed = await tx.serviceBill.updateMany({
    where: {
      id: billId,
      version: bill.version,
      status: "POSTED",
      paidAmountPaise: bill.paidAmountPaise,
    },
    data: { paidAmountPaise: { decrement: amount }, version: { increment: 1 } },
  });
  if (claimed.count !== 1)
    throw new ConflictError("Bill changed. Refresh before reversing.");
  if (
    !shared &&
    (await tx.vendorPaymentSlipLine.findFirst({
      where: { sourceType: "SERVICE_BILL", sourceId: billId, isActive: true },
      select: { id: true },
    }))
  )
    throw new ConflictError(
      "Cancel the active payment slip before reversing a legacy settlement",
    );
  const journalId =
    "settlementJournalEntryId" in payment
      ? payment.settlementJournalEntryId
      : payment.journalEntryId;
  if (!journalId)
    throw new BadRequestError(
      "Settlement voucher is missing; reconcile before reversing",
    );
  const journal = await tx.journalEntry.findUnique({
    where: { id: journalId },
    include: {
      lines: {
        include: {
          ledger: {
            select: {
              sparePartSupplierId: true,
              code: true,
              cashAccountId: true,
            },
          },
        },
      },
    },
  });
  if (
    !journal ||
    journal.status !== "POSTED" ||
    journal.branchId !== input.branchId ||
    journal.sourceId !== payment.id ||
    journal.sourceType !== (shared ? "VENDOR_PAYMENT" : "SERVICE_BILL")
  )
    throw new ConflictError(
      "Settlement voucher does not match; reconcile before reversing",
    );
  const providerAmount = journal.lines
    .filter(
      (line) => line.ledger.sparePartSupplierId === bill.serviceProviderId,
    )
    .reduce((sum, line) => sum + line.debitPaise - line.creditPaise, 0n);
  const tdsAmount = journal.lines
    .filter((line) => line.ledger.code === "TDS_PAYABLE")
    .reduce((sum, line) => sum + line.creditPaise - line.debitPaise, 0n);
  const fundingAmount = journal.lines
    .filter((line) =>
      "fundingLedgerId" in payment
        ? line.ledgerId === payment.fundingLedgerId
        : line.ledger.cashAccountId === payment.fromAccountId,
    )
    .reduce((sum, line) => sum + line.creditPaise - line.debitPaise, 0n);
  if (
    providerAmount !== amount ||
    tdsAmount !== payment.tdsPaise ||
    fundingAmount !== payment.paidPaise ||
    journal.lines.reduce(
      (sum, line) => sum + line.debitPaise - line.creditPaise,
      0n,
    ) !== 0n
  )
    throw new ConflictError(
      "Settlement voucher amounts do not reconcile; review before reversing",
    );
  const reversal = await reverseJournal(tx, journalId, input.reason, actorId);
  const data = {
    reversedAt: new Date(),
    reversedById: actorId,
    reversalReason: input.reason,
    reversalJournalEntryId: reversal.id,
  };
  if (shared)
    await tx.vendorPaymentDisbursement.update({
      where: { id: payment.id },
      data,
    });
  else await tx.serviceBillPayment.update({ where: { id: payment.id }, data });
  if (slip) {
    const paidPaise = slip.paidPaise - amount;
    const updated = await tx.vendorPaymentSlip.updateMany({
      where: { id: slip.id, version: slip.version, paidPaise: slip.paidPaise },
      data: {
        paidPaise,
        status: paidPaise === 0n ? "APPROVED" : "PARTIALLY_PAID",
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1)
      throw new ConflictError("Slip changed. Refresh before reversing.");
  }
  return { billId, slipId: slip?.id, reversalJournalEntryId: reversal.id };
}
