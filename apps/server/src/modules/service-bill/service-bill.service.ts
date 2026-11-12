import type { z } from "zod";
import type { createServiceBillSchema } from "@skerp/validators";
import type { Prisma } from "../../../generated/prisma/index.js";
import { BadRequestError, ConflictError } from "../../lib/error.js";
import {
  fyCodeFor,
  formatDocNumber,
  nextSequence,
} from "../_shared/doc-number.js";
import {
  postServiceBillVoucher,
  reverseJournal,
} from "../ledger/posting.service.js";

type Tx = Prisma.TransactionClient;
type CreateInput = z.infer<typeof createServiceBillSchema>;

/** Caller owns the transaction and authorises input.branchId. */
export async function createServiceBillTx(
  tx: Tx,
  input: CreateInput,
  branchCode: string,
  actorId: string,
) {
  const ids = input.jobCardServiceLineIds;
  if (!ids.length || new Set(ids).size !== ids.length)
    throw new BadRequestError("Select unique completed service lines");
  const lines = await tx.jobCardServiceLine.findMany({
    where: { id: { in: ids } },
    include: {
      jobCard: {
        select: {
          id: true,
          jobCardNumber: true,
          vehicleId: true,
          branchId: true,
          status: true,
          finalisedAt: true,
          version: true,
        },
      },
      sparePart: { select: { id: true, name: true } },
    },
  });
  if (lines.length !== ids.length)
    throw new BadRequestError("One or more service lines not found");
  for (const line of lines) {
    if (
      line.jobCard.branchId !== input.branchId ||
      line.serviceProviderId !== input.serviceProviderId
    )
      throw new BadRequestError(
        "All services must belong to the selected branch and provider",
      );
    if (line.jobCard.status !== "FINALISED" || line.billedInServiceBillId)
      throw new ConflictError(
        "A selected service is no longer eligible for billing. Refresh and try again.",
      );
  }
  // Coordinate with undo-finalise using the same parent version/status claim.
  const cards = new Map(lines.map((line) => [line.jobCard.id, line.jobCard]));
  for (const id of [...cards.keys()].sort()) {
    const card = cards.get(id)!;
    const claimed = await tx.jobCard.updateMany({
      where: {
        id,
        branchId: input.branchId,
        status: "FINALISED",
        version: card.version,
      },
      data: { version: { increment: 1 } },
    });
    if (claimed.count !== 1)
      throw new ConflictError("A job card changed. Refresh before billing.");
  }
  const grossAmountPaise = lines.reduce(
    (sum, line) => sum + line.amountPaise,
    0n,
  );
  if (input.discountPaise > grossAmountPaise)
    throw new BadRequestError("Discount cannot exceed the gross amount");
  const netAmountPaise = grossAmountPaise - input.discountPaise;
  const fyCode = fyCodeFor(input.billDate);
  const seq = await nextSequence(tx, branchCode, fyCode, "SBILL");
  const serviceBillNumber = formatDocNumber(
    branchCode,
    fyCode,
    seq,
    "SKT/SBILL",
  );
  const bill = await tx.serviceBill.create({
    data: {
      serviceBillNumber,
      fyCode,
      branchId: input.branchId,
      serviceProviderId: input.serviceProviderId,
      status: "POSTED",
      billDate: input.billDate,
      providerInvoiceNo: input.providerInvoiceNo,
      providerInvoiceDate: input.providerInvoiceDate,
      grossAmountPaise,
      discountPaise: input.discountPaise,
      netAmountPaise,
      remarks: input.remarks,
      createdById: actorId,
      postedById: actorId,
      postedAt: new Date(),
    },
    select: { id: true },
  });
  const claimed = await tx.jobCardServiceLine.updateMany({
    where: { id: { in: ids }, billedInServiceBillId: null },
    data: { billedInServiceBillId: bill.id },
  });
  if (claimed.count !== ids.length)
    throw new ConflictError(
      "A selected service was billed by another user. Refresh and try again.",
    );
  await tx.serviceBillLine.createMany({
    data: lines.map((line) => ({
      serviceBillId: bill.id,
      jobCardServiceLineId: line.id,
      amountPaise: line.amountPaise,
      serviceSnapshot: {
        id: line.id,
        sparePartId: line.sparePartId,
        qty: line.qty,
        ratePaise: line.ratePaise.toString(),
        amountPaise: line.amountPaise.toString(),
        description: line.description,
        jobCard: {
          id: line.jobCard.id,
          jobCardNumber: line.jobCard.jobCardNumber,
          vehicleId: line.jobCard.vehicleId,
          finalisedAt: line.jobCard.finalisedAt?.toISOString() ?? null,
        },
        sparePart: line.sparePart,
      },
    })),
  });
  const voucher = await postServiceBillVoucher(tx, {
    serviceBillId: bill.id,
    serviceBillNumber,
    billDate: input.billDate,
    branchId: input.branchId,
    fyCode,
    serviceProviderId: input.serviceProviderId,
    netAmountPaise,
    createdById: actorId,
  });
  return tx.serviceBill.update({
    where: { id: bill.id },
    data: { journalEntryId: voucher.id },
    select: { id: true },
  });
}

/** Lock the bill with a conditional transition before releasing lines. */
export async function cancelServiceBillTx(
  tx: Tx,
  bill: { id: string; version: number; journalEntryId: string | null },
  reason: string,
  actorId: string,
) {
  const claimed = await tx.serviceBill.updateMany({
    where: {
      id: bill.id,
      version: bill.version,
      status: "POSTED",
      paidAmountPaise: 0n,
    },
    data: {
      status: "CANCELLED",
      version: { increment: 1 },
      cancelledById: actorId,
      cancelledAt: new Date(),
      cancelReason: reason,
    },
  });
  if (claimed.count !== 1)
    throw new ConflictError(
      "Bill changed or has payments. Refresh before cancelling.",
    );
  if (await tx.serviceBillPayment.count({ where: { serviceBillId: bill.id } }))
    throw new BadRequestError("A bill with payments cannot be cancelled");
  await tx.jobCardServiceLine.updateMany({
    where: { billedInServiceBillId: bill.id },
    data: { billedInServiceBillId: null },
  });
  // Retain original lines and snapshots; the active claim is on the source line.
  if (bill.journalEntryId)
    await reverseJournal(tx, bill.journalEntryId, reason, actorId);
}

export async function reserveServiceBillPaymentTx(
  tx: Tx,
  billId: string,
  settledPaise: bigint,
) {
  const bill = await tx.serviceBill.findUniqueOrThrow({
    where: { id: billId },
  });
  if (bill.status !== "POSTED")
    throw new ConflictError("Only a POSTED service bill can be paid");
  if (
    settledPaise <= 0n ||
    settledPaise > bill.netAmountPaise - bill.paidAmountPaise
  )
    throw new BadRequestError("Paid + TDS exceeds the pending amount");
  const claimed = await tx.serviceBill.updateMany({
    where: {
      id: billId,
      status: "POSTED",
      version: bill.version,
      paidAmountPaise: bill.paidAmountPaise,
    },
    data: {
      version: { increment: 1 },
      paidAmountPaise: { increment: settledPaise },
    },
  });
  if (claimed.count !== 1)
    throw new ConflictError(
      "Bill changed during payment. Refresh and try again.",
    );
}
