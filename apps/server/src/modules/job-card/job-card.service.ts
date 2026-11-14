import type { Prisma } from "../../../generated/prisma/index.js";
import { BadRequestError, ConflictError } from "../../lib/error.js";
import { postJobCardPartsVoucher } from "../ledger/posting.service.js";
import { assertRepairClearanceTx } from "./job-card-repair.service.js";

export type FinaliseInput = { outDateTime: Date; closingKm: number };
export type FinaliseJobCard = {
  id: string;
  version: number;
  jobCardNumber: string | null;
  branchId: string;
  fyCode: string;
  openingKm: number;
  inDateTime: Date;
  partLines: {
    id: string;
    sparePartId: string;
    batchId: string;
    qty: number;
  }[];
  serviceLines: { amountPaise: bigint }[];
};

/** All callers must run this inside one database transaction. */
export async function finaliseJobCardTx(
  tx: Prisma.TransactionClient,
  existing: FinaliseJobCard,
  input: FinaliseInput,
  actorUserId: string,
) {
  if (!existing.partLines.length && !existing.serviceLines.length)
    throw new BadRequestError(
      "A job card needs at least one part or service line to finalise",
    );
  if (input.closingKm < existing.openingKm)
    throw new BadRequestError("Closing KM cannot be less than opening KM");
  if (input.outDateTime < existing.inDateTime)
    throw new BadRequestError("Out date/time cannot be before in date/time");

  // Claim the parent before stock or journals. A competing edit/finalise
  // either finishes first or fails the version/status condition after waiting.
  const claimed = await tx.jobCard.updateMany({
    where: { id: existing.id, status: "DRAFT", version: existing.version },
    data: { version: { increment: 1 } },
  });
  if (claimed.count !== 1)
    throw new ConflictError(
      "Job card changed. Refresh before finalising again.",
    );
  await assertRepairClearanceTx(tx, existing.id, input.outDateTime);

  const batchDemand = new Map<string, number>();
  const linesByPart = new Map<string, FinaliseJobCard["partLines"]>();
  for (const line of existing.partLines) {
    batchDemand.set(
      line.batchId,
      (batchDemand.get(line.batchId) ?? 0) + line.qty,
    );
    const lines = linesByPart.get(line.sparePartId) ?? [];
    lines.push(line);
    linesByPart.set(line.sparePartId, lines);
  }
  const batches = await tx.spareBatch.findMany({
    where: { id: { in: [...batchDemand.keys()] }, branchId: existing.branchId },
  });
  const batchById = new Map(batches.map((batch) => [batch.id, batch]));
  for (const line of existing.partLines) {
    const batch = batchById.get(line.batchId);
    if (!batch || batch.sparePartId !== line.sparePartId)
      throw new BadRequestError(
        "A part line's batch is invalid or belongs to another branch",
      );
  }

  // Stable acquisition order reduces deadlocks between jobs sharing stock.
  // Conditional decrements enforce aggregate demand even after a concurrent issue.
  for (const batchId of [...batchDemand.keys()].sort()) {
    const qty = batchDemand.get(batchId)!;
    const batch = batchById.get(batchId)!;
    const issued = await tx.spareBatch.updateMany({
      where: {
        id: batchId,
        branchId: existing.branchId,
        qtyRemaining: { gte: qty },
      },
      data: { qtyRemaining: { decrement: qty } },
    });
    if (issued.count !== 1)
      throw new ConflictError(
        `Insufficient stock in batch ${batch.batchNo ?? batchId}. Refresh and try again.`,
      );
  }

  let totalPartsAmountPaise = 0n;
  const movements: Prisma.StockMovementCreateManyInput[] = [];
  for (const sparePartId of [...linesByPart.keys()].sort()) {
    const lines = linesByPart.get(sparePartId)!;
    const demand = lines.reduce((sum, line) => sum + line.qty, 0);
    const issued = await tx.stockLedger.updateMany({
      where: {
        sparePartId,
        branchId: existing.branchId,
        currentQty: { gte: demand },
      },
      data: { currentQty: { decrement: demand } },
    });
    if (issued.count !== 1)
      throw new ConflictError(
        "Branch stock is insufficient or missing. Reconcile stock before finalising.",
      );
    const ledger = await tx.stockLedger.findUniqueOrThrow({
      where: {
        sparePartId_branchId: { sparePartId, branchId: existing.branchId },
      },
    });
    let balance = ledger.currentQty + demand;
    for (const line of lines) {
      const batch = batchById.get(line.batchId)!;
      const amountPaise = batch.unitCostPaise * BigInt(line.qty);
      totalPartsAmountPaise += amountPaise;
      await tx.jobCardPartLine.update({
        where: { id: line.id },
        data: { unitCostPaise: batch.unitCostPaise, amountPaise },
      });
      balance -= line.qty;
      movements.push({
        sparePartId,
        branchId: existing.branchId,
        movementType: "ISSUE",
        qtyDelta: -line.qty,
        unitCostPaise: batch.unitCostPaise,
        balanceQtyAfter: balance,
        refType: "JOB_CARD",
        refId: existing.id,
        createdById: actorUserId,
      });
    }
  }
  if (movements.length) await tx.stockMovement.createMany({ data: movements });

  const totalServiceAmountPaise = existing.serviceLines.reduce(
    (sum, line) => sum + line.amountPaise,
    0n,
  );
  const voucher =
    totalPartsAmountPaise > 0n
      ? await postJobCardPartsVoucher(tx, {
          jobCardId: existing.id,
          jobCardNumber: existing.jobCardNumber!,
          finaliseDate: input.outDateTime,
          branchId: existing.branchId,
          fyCode: existing.fyCode,
          totalPartsAmountPaise,
          createdById: actorUserId,
        })
      : null;
  return tx.jobCard.update({
    where: { id: existing.id },
    data: {
      status: "FINALISED",
      outDateTime: input.outDateTime,
      closingKm: input.closingKm,
      totalPartsAmountPaise,
      totalServiceAmountPaise,
      totalAmountPaise: totalPartsAmountPaise + totalServiceAmountPaise,
      journalEntryId: voucher?.id ?? null,
      finalisedById: actorUserId,
      finalisedAt: new Date(),
    },
    select: { id: true },
  });
}
