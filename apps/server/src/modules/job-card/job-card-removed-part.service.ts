import { createHash } from "node:crypto";
import type { z } from "zod";
import type { createJobCardRemovedPartSchema } from "@skerp/validators";
import type { Prisma } from "../../../generated/prisma/index.js";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../lib/error.js";
import {
  fyCodeFor,
  formatDocNumber,
  nextSequence,
} from "../_shared/doc-number.js";
import { postPartReturnVoucher } from "../ledger/posting.service.js";

type Tx = Prisma.TransactionClient;
type Input = z.infer<typeof createJobCardRemovedPartSchema>;

export function removedPartFingerprint(jobCardId: string, input: Input) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        jobCardId,
        sparePartId: input.sparePartId,
        relatedPartLineId: input.relatedPartLineId ?? null,
        qty: input.qty,
        condition: input.condition,
        unitCostPaise: input.unitCostPaise?.toString() ?? null,
        remarks: input.remarks ?? null,
      }),
    )
    .digest("hex");
}

/** Caller authorises branchId; all effects commit or roll back together. */
export async function createRemovedPartTx(
  tx: Tx,
  jobCardId: string,
  branchId: string,
  input: Input,
  actorId: string,
) {
  const fingerprint = removedPartFingerprint(jobCardId, input);
  const prior = await tx.jobCardRemovedPart.findUnique({
    where: { clientRequestId: input.clientRequestId },
  });
  if (prior) {
    if (
      prior.jobCardId !== jobCardId ||
      prior.requestFingerprint !== fingerprint
    )
      throw new ConflictError(
        "This request ID was used for a different removed-part entry",
      );
    return { id: prior.id };
  }
  const card = await tx.jobCard.findUnique({
    where: { id: jobCardId },
    select: { id: true, branchId: true, status: true, version: true },
  });
  if (!card || card.branchId !== branchId)
    throw new NotFoundError("Job card not found");
  if (card.status !== "FINALISED")
    throw new BadRequestError(
      "Only a FINALISED job card can record removed parts",
    );
  const claimed = await tx.jobCard.updateMany({
    where: {
      id: jobCardId,
      branchId,
      status: "FINALISED",
      version: card.version,
    },
    data: { version: { increment: 1 } },
  });
  if (claimed.count !== 1) {
    const concurrent = await tx.jobCardRemovedPart.findUnique({
      where: { clientRequestId: input.clientRequestId },
    });
    if (
      concurrent?.jobCardId === jobCardId &&
      concurrent.requestFingerprint === fingerprint
    )
      return { id: concurrent.id };
    throw new ConflictError(
      "Job card changed. Refresh before recording the removed part.",
    );
  }
  let relatedLine: {
    id: string;
    jobCardId: string;
    sparePartId: string;
    batchId: string;
    unitCostPaise: bigint;
    qty: number;
  } | null = null;
  if (input.relatedPartLineId) {
    relatedLine = await tx.jobCardPartLine.findUnique({
      where: { id: input.relatedPartLineId },
    });
    if (
      !relatedLine ||
      relatedLine.jobCardId !== jobCardId ||
      relatedLine.sparePartId !== input.sparePartId
    )
      throw new BadRequestError(
        "The original issue line must match this job card and spare part",
      );
    const recorded = await tx.jobCardRemovedPart.aggregate({
      where: { relatedPartLineId: relatedLine.id },
      _sum: { qty: true },
    });
    if ((recorded._sum.qty ?? 0) + input.qty > relatedLine.qty)
      throw new BadRequestError(
        "Removed quantity exceeds the original issue line's remaining quantity",
      );
  }
  const part = await tx.sparePart.findUnique({
    where: { id: input.sparePartId },
    select: { supplierId: true, type: true },
  });
  if (!part || part.type !== "Item")
    throw new BadRequestError("Select a spare part item, not a service");
  const common = {
    jobCardId,
    sparePartId: input.sparePartId,
    relatedPartLineId: input.relatedPartLineId,
    qty: input.qty,
    condition: input.condition,
    remarks: input.remarks,
    createdById: actorId,
    clientRequestId: input.clientRequestId,
    requestFingerprint: fingerprint,
  };
  if (input.condition !== "REUSABLE") {
    return tx.jobCardRemovedPart.create({ data: common, select: { id: true } });
  }
  // Preserve the existing policy: explicit entered value, else linked issue
  // cost. Financial valuation policy changes need a separate agreed change.
  const unitCostPaise = input.unitCostPaise ?? relatedLine?.unitCostPaise;
  if (unitCostPaise === undefined || unitCostPaise <= 0n)
    throw new BadRequestError(
      "A reusable part needs a positive return cost or a valued issue line",
    );
  const originalBatch = relatedLine
    ? await tx.spareBatch.findUnique({
        where: { id: relatedLine.batchId },
        select: { supplierId: true },
      })
    : null;
  const supplierId = originalBatch?.supplierId ?? part.supplierId;
  const batch = await tx.spareBatch.create({
    data: {
      sparePartId: input.sparePartId,
      supplierId,
      branchId,
      qtyReceived: input.qty,
      qtyRemaining: input.qty,
      unitCostPaise,
    },
  });
  const stock = await tx.stockLedger.upsert({
    where: {
      sparePartId_branchId: { sparePartId: input.sparePartId, branchId },
    },
    create: {
      sparePartId: input.sparePartId,
      branchId,
      currentQty: 0,
      movingAvgCostPaise: 0n,
    },
    update: {},
  });
  if (stock.currentQty < 0)
    throw new BadRequestError(
      "Reconcile negative branch stock before returning a part",
    );
  const newQty = stock.currentQty + input.qty;
  const newAvg =
    (stock.movingAvgCostPaise * BigInt(stock.currentQty) +
      unitCostPaise * BigInt(input.qty)) /
    BigInt(newQty);
  const stockClaim = await tx.stockLedger.updateMany({
    where: {
      sparePartId: input.sparePartId,
      branchId,
      currentQty: stock.currentQty,
      movingAvgCostPaise: stock.movingAvgCostPaise,
    },
    data: { currentQty: { increment: input.qty }, movingAvgCostPaise: newAvg },
  });
  if (stockClaim.count !== 1)
    throw new ConflictError(
      "Stock changed during the return. Refresh and try again.",
    );
  const created = await tx.jobCardRemovedPart.create({
    data: { ...common, unitCostPaise, newBatchId: batch.id },
    select: { id: true },
  });
  await tx.stockMovement.create({
    data: {
      sparePartId: input.sparePartId,
      branchId,
      movementType: "RETURN",
      qtyDelta: input.qty,
      unitCostPaise,
      balanceQtyAfter: newQty,
      refType: "JOB_CARD_REMOVED_PART",
      refId: created.id,
      createdById: actorId,
    },
  });
  const branch = await tx.branch.findUniqueOrThrow({
    where: { id: branchId },
    select: { branchCode: true },
  });
  const now = new Date();
  const fyCode = fyCodeFor(now);
  const seq = await nextSequence(tx, branch.branchCode, fyCode, "JCRP");
  const voucher = await postPartReturnVoucher(tx, {
    removedPartId: created.id,
    voucherNumber: formatDocNumber(branch.branchCode, fyCode, seq, "SKT/JCRP"),
    voucherDate: now,
    branchId,
    fyCode,
    amountPaise: unitCostPaise * BigInt(input.qty),
    createdById: actorId,
  });
  return tx.jobCardRemovedPart.update({
    where: { id: created.id },
    data: { journalEntryId: voucher.id },
    select: { id: true },
  });
}
