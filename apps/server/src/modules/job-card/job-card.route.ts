import { Router } from "express";
import { PERMS } from "@skerp/types";
import {
  createJobCardSchema,
  updateJobCardSchema,
  finaliseJobCardSchema,
  cancelJobCardSchema,
  jobCardListQuerySchema,
  createJobCardRemovedPartSchema,
  undoFinaliseJobCardSchema,
} from "@skerp/validators";
import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { branchFilter, assertBranchAccess } from "../../auth/branch-scope.js";
import { BadRequestError, NotFoundError } from "../../lib/error.js";
import { sendOk } from "../_shared/response.js";
import { getParamId } from "../_shared/param.js";
import { fyCodeFor, formatDocNumber, nextSequence } from "../_shared/doc-number.js";
import { postJobCardPartsVoucher, postPartReturnVoucher, reverseJournal } from "../ledger/posting.service.js";

const router: Router = Router();
router.use(authMiddleware);

const actorId = (req: { user?: { userId: string } }) => req.user!.userId;

const jobCardDetailInclude = {
  branch: { select: { id: true, name: true, branchCode: true } },
  vehicle: { select: { id: true, vehicleNumber: true } },
  driver: { select: { id: true, name: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  partLines: {
    include: {
      sparePart: { select: { id: true, name: true, unit: true } },
      batch: { select: { id: true, batchNo: true, qtyRemaining: true } },
      mechanic: { select: { id: true, name: true } },
    },
  },
  serviceLines: {
    include: {
      sparePart: { select: { id: true, name: true } },
      serviceProvider: { select: { id: true, name: true } },
      mechanic: { select: { id: true, name: true } },
    },
  },
  journalEntry: {
    select: { id: true, voucherNumber: true, status: true, tallySyncStatus: true },
  },
};

router.get("/", can(PERMS.WORKSHOP.JOBCARD_VIEW), async (req, res) => {
  const query = jobCardListQuerySchema.parse(req.query);
  const where = {
    ...branchFilter(req),
    ...(query.branchId ? { branchId: query.branchId } : {}),
    ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
    ...(query.status ? { status: query.status } : {}),
  };
  const [jobCards, total] = await Promise.all([
    db.jobCard.findMany({
      where,
      include: jobCardDetailInclude,
      orderBy: { createdAt: "desc" },
      skip: query.page * query.size,
      take: query.size,
    }),
    db.jobCard.count({ where }),
  ]);
  sendOk(res, jobCards, { page: query.page, size: query.size, total });
});

/**
 * Batches with stock remaining for a part at a branch — feeds the
 * batch-wise part picker (old ERP shows stock "invoice/batch-wise").
 * Oldest first, as a natural FIFO suggestion; the user still picks manually.
 */
router.get("/lookup/batches", can(PERMS.WORKSHOP.JOBCARD_VIEW), async (req, res) => {
  const sparePartId = String(req.query.sparePartId ?? "");
  const branchId = String(req.query.branchId ?? "");
  if (!sparePartId || !branchId)
    throw new BadRequestError("sparePartId and branchId are required");

  const batches = await db.spareBatch.findMany({
    where: { sparePartId, branchId, qtyRemaining: { gt: 0 } },
    select: {
      id: true,
      batchNo: true,
      qtyRemaining: true,
      unitCostPaise: true,
      warrantyExpiry: true,
      createdAt: true,
      inwardLine: {
        select: { inward: { select: { inwardNumber: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  sendOk(
    res,
    batches.map((b) => ({
      id: b.id,
      batchNo: b.batchNo,
      qtyRemaining: b.qtyRemaining,
      unitCostPaise: b.unitCostPaise,
      warrantyExpiry: b.warrantyExpiry,
      // A batch with no inward line came from a Removed-Part reusable return,
      // not a fresh purchase — surfaced so the picker can label it.
      sourceInvoiceNumber: b.inwardLine?.inward.inwardNumber ?? null,
      source: b.inwardLine ? "PURCHASE" : "RETURN",
    })),
  );
});

router.get("/:id", can(PERMS.WORKSHOP.JOBCARD_VIEW), async (req, res) => {
  const jobCard = await db.jobCard.findUnique({
    where: { id: getParamId(req) },
    include: jobCardDetailInclude,
  });
  if (!jobCard) throw new NotFoundError("Job card not found");
  sendOk(res, jobCard);
});

router.post("/", can(PERMS.WORKSHOP.JOBCARD_MANAGE), async (req, res) => {
  const input = createJobCardSchema.parse(req.body);
  assertBranchAccess(req, input.branchId);

  const branch = await db.branch.findUnique({
    where: { id: input.branchId },
    select: { branchCode: true },
  });
  if (!branch) throw new BadRequestError("Branch not found");

  const fyCode = fyCodeFor(input.inDateTime);

  const jobCard = await db.$transaction(async (tx) => {
    const seq = await nextSequence(tx, branch.branchCode, fyCode, "JC");
    const jobCardNumber = formatDocNumber(branch.branchCode, fyCode, seq, "SKT/JC");

    return tx.jobCard.create({
      data: {
        jobCardNumber,
        fyCode,
        branchId: input.branchId,
        vehicleId: input.vehicleId,
        driverId: input.driverId,
        truckStatus: input.truckStatus,
        inDateTime: input.inDateTime,
        openingKm: input.openingKm,
        remarks: input.remarks,
        createdById: actorId(req),
        partLines: {
          create: input.partLines.map((line) => ({
            sparePartId: line.sparePartId,
            batchId: line.batchId,
            mechanicId: line.mechanicId,
            qty: line.qty,
            unitCostPaise: 0n, // snapshotted from the batch at Finalise
            amountPaise: 0n,
            description: line.description,
          })),
        },
        serviceLines: {
          create: input.serviceLines.map((line) => ({
            serviceProviderId: line.serviceProviderId,
            sparePartId: line.sparePartId,
            mechanicId: line.mechanicId,
            qty: line.qty,
            ratePaise: line.ratePaise,
            amountPaise: line.ratePaise * BigInt(line.qty),
            description: line.description,
          })),
        },
      },
      select: { id: true },
    });
  });

  const created = await db.jobCard.findUnique({
    where: { id: jobCard.id },
    include: jobCardDetailInclude,
  });
  sendOk(res, created, undefined, 201);
});

router.patch("/:id", can(PERMS.WORKSHOP.JOBCARD_MANAGE), async (req, res) => {
  const input = updateJobCardSchema.parse(req.body);
  const existing = await db.jobCard.findUnique({
    where: { id: getParamId(req) },
    select: { id: true, status: true, branchId: true },
  });
  if (!existing) throw new NotFoundError("Job card not found");
  if (existing.status !== "DRAFT")
    throw new BadRequestError("Only a DRAFT job card can be edited");
  assertBranchAccess(req, input.branchId ?? existing.branchId);

  await db.$transaction(async (tx) => {
    if (input.partLines) await tx.jobCardPartLine.deleteMany({ where: { jobCardId: existing.id } });
    if (input.serviceLines)
      await tx.jobCardServiceLine.deleteMany({ where: { jobCardId: existing.id } });

    await tx.jobCard.update({
      where: { id: existing.id },
      data: {
        ...(input.branchId ? { branchId: input.branchId } : {}),
        ...(input.vehicleId ? { vehicleId: input.vehicleId } : {}),
        ...(input.driverId ? { driverId: input.driverId } : {}),
        ...(input.truckStatus ? { truckStatus: input.truckStatus } : {}),
        ...(input.inDateTime ? { inDateTime: input.inDateTime } : {}),
        ...(input.openingKm !== undefined ? { openingKm: input.openingKm } : {}),
        ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
        version: { increment: 1 },
        ...(input.partLines
          ? {
            partLines: {
              create: input.partLines.map((line) => ({
                sparePartId: line.sparePartId,
                batchId: line.batchId,
                mechanicId: line.mechanicId,
                qty: line.qty,
                unitCostPaise: 0n,
                amountPaise: 0n,
                description: line.description,
              })),
            },
          }
          : {}),
        ...(input.serviceLines
          ? {
            serviceLines: {
              create: input.serviceLines.map((line) => ({
                serviceProviderId: line.serviceProviderId,
                sparePartId: line.sparePartId,
                mechanicId: line.mechanicId,
                qty: line.qty,
                ratePaise: line.ratePaise,
                amountPaise: line.ratePaise * BigInt(line.qty),
                description: line.description,
              })),
            },
          }
          : {}),
      },
    });
  });

  const updated = await db.jobCard.findUnique({
    where: { id: existing.id },
    include: jobCardDetailInclude,
  });
  sendOk(res, updated);
});

/**
 * Finalise: parts are actually issued here (not at Save) — batch-specific
 * cost is snapshotted, stock decrements, and one expense voucher posts.
 * Service lines are recorded for total but post nothing yet (Service Bill,
 * a later story, does that). A Job Card with zero part lines posts no
 * voucher. FINALISED is terminal for v1 — no reverse/reopen path yet.
 */
router.post("/:id/finalise", can(PERMS.WORKSHOP.JOBCARD_FINALISE), async (req, res) => {
  const input = finaliseJobCardSchema.parse(req.body);

  const existing = await db.jobCard.findUnique({
    where: { id: getParamId(req) },
    include: { partLines: true, serviceLines: true },
  });
  if (!existing) throw new NotFoundError("Job card not found");
  if (existing.status !== "DRAFT")
    throw new BadRequestError("Only a DRAFT job card can be finalised");
  if (existing.partLines.length === 0 && existing.serviceLines.length === 0)
    throw new BadRequestError("A job card needs at least one part or service line to finalise");
  if (input.closingKm < existing.openingKm)
    throw new BadRequestError("Closing KM cannot be less than opening KM");
  assertBranchAccess(req, existing.branchId);

  const totalServiceAmountPaise = existing.serviceLines.reduce((s, l) => s + l.amountPaise, 0n);

  const finalised = await db.$transaction(async (tx) => {
    let totalPartsAmountPaise = 0n;

    for (const line of existing.partLines) {
      // Re-read under the transaction to close the race window against a
      // concurrent finalise/inward-cancel touching the same batch.
      const batch = await tx.spareBatch.findUnique({ where: { id: line.batchId } });
      if (!batch || batch.sparePartId !== line.sparePartId)
        throw new BadRequestError("A part line's batch is no longer valid");
      if (batch.qtyRemaining < line.qty)
        throw new BadRequestError(
          `Insufficient stock in batch ${batch.batchNo ?? batch.id} for ${line.sparePartId} (available: ${batch.qtyRemaining}, needed: ${line.qty})`,
        );

      const amountPaise = batch.unitCostPaise * BigInt(line.qty);
      totalPartsAmountPaise += amountPaise;

      await tx.jobCardPartLine.update({
        where: { id: line.id },
        data: { unitCostPaise: batch.unitCostPaise, amountPaise },
      });

      await tx.spareBatch.update({
        where: { id: batch.id },
        data: { qtyRemaining: { decrement: line.qty } },
      });

      const stockLedger = await tx.stockLedger.findUnique({
        where: { sparePartId_branchId: { sparePartId: line.sparePartId, branchId: existing.branchId } },
      });
      const newQty = (stockLedger?.currentQty ?? 0) - line.qty;

      await tx.stockLedger.update({
        where: { sparePartId_branchId: { sparePartId: line.sparePartId, branchId: existing.branchId } },
        data: { currentQty: newQty },
      });

      await tx.stockMovement.create({
        data: {
          sparePartId: line.sparePartId,
          branchId: existing.branchId,
          movementType: "ISSUE",
          qtyDelta: -line.qty,
          unitCostPaise: batch.unitCostPaise,
          balanceQtyAfter: newQty,
          refType: "JOB_CARD",
          refId: existing.id,
          createdById: actorId(req),
        },
      });
    }

    let journalEntryId: string | null = null;
    if (totalPartsAmountPaise > 0n) {
      const voucher = await postJobCardPartsVoucher(tx, {
        jobCardId: existing.id,
        jobCardNumber: existing.jobCardNumber!,
        finaliseDate: input.outDateTime,
        branchId: existing.branchId,
        fyCode: existing.fyCode,
        totalPartsAmountPaise,
        createdById: actorId(req),
      });
      journalEntryId = voucher.id;
    }

    return tx.jobCard.update({
      where: { id: existing.id },
      data: {
        status: "FINALISED",
        outDateTime: input.outDateTime,
        closingKm: input.closingKm,
        totalPartsAmountPaise,
        totalServiceAmountPaise,
        totalAmountPaise: totalPartsAmountPaise + totalServiceAmountPaise,
        journalEntryId,
        finalisedById: actorId(req),
        finalisedAt: new Date(),
      },
      select: { id: true },
    });
  });

  const result = await db.jobCard.findUnique({
    where: { id: finalised.id },
    include: jobCardDetailInclude,
  });
  sendOk(res, result);
});

/**
 * Undo Finalise: only safe while nothing downstream has consumed the
 * finalised parts/service lines yet — no Service Bill line and no Removed
 * Part / Supplier Replacement activity against this job card. Reverses the
 * exact effects Finalise made: restores batch/ledger qty, writes offsetting
 * StockMovement rows, reverses the parts voucher, and drops the job card
 * back to DRAFT so it can be edited and re-finalised.
 */
router.post("/:id/undo-finalise", can(PERMS.WORKSHOP.JOBCARD_FINALISE), async (req, res) => {
  const input = undoFinaliseJobCardSchema.parse(req.body);

  const existing = await db.jobCard.findUnique({
    where: { id: getParamId(req) },
    include: { partLines: true, serviceLines: true, removedParts: { select: { id: true } } },
  });
  if (!existing) throw new NotFoundError("Job card not found");
  if (existing.status !== "FINALISED")
    throw new BadRequestError("Only a FINALISED job card can have its finalise undone");
  assertBranchAccess(req, existing.branchId);

  if (existing.serviceLines.some((l) => l.billedInServiceBillId !== null))
    throw new BadRequestError(
      "This job card has already been billed — undo is only possible before billing",
    );
  if (existing.removedParts.length > 0)
    throw new BadRequestError(
      "This job card already has removed-parts activity recorded — undo is no longer possible",
    );

  const undone = await db.$transaction(async (tx) => {
    for (const line of existing.partLines) {
      await tx.spareBatch.update({
        where: { id: line.batchId },
        data: { qtyRemaining: { increment: line.qty } },
      });

      const stockLedger = await tx.stockLedger.findUnique({
        where: { sparePartId_branchId: { sparePartId: line.sparePartId, branchId: existing.branchId } },
      });
      const newQty = (stockLedger?.currentQty ?? 0) + line.qty;

      await tx.stockLedger.update({
        where: { sparePartId_branchId: { sparePartId: line.sparePartId, branchId: existing.branchId } },
        data: { currentQty: newQty },
      });

      await tx.stockMovement.create({
        data: {
          sparePartId: line.sparePartId,
          branchId: existing.branchId,
          movementType: "ADJUSTMENT",
          qtyDelta: line.qty,
          unitCostPaise: line.unitCostPaise,
          balanceQtyAfter: newQty,
          refType: "JOBCARD_FINALISE_UNDO",
          refId: existing.id,
          createdById: actorId(req),
        },
      });

      await tx.jobCardPartLine.update({
        where: { id: line.id },
        data: { unitCostPaise: 0n, amountPaise: 0n },
      });
    }

    if (existing.journalEntryId)
      await reverseJournal(tx, existing.journalEntryId, input.reason, actorId(req));

    return tx.jobCard.update({
      where: { id: existing.id },
      data: {
        status: "DRAFT",
        outDateTime: null,
        closingKm: null,
        totalPartsAmountPaise: 0n,
        totalServiceAmountPaise: 0n,
        totalAmountPaise: 0n,
        journalEntryId: null,
        finalisedById: null,
        finalisedAt: null,
      },
      select: { id: true },
    });
  });

  const result = await db.jobCard.findUnique({
    where: { id: undone.id },
    include: jobCardDetailInclude,
  });
  sendOk(res, result);
});

router.post("/:id/cancel", can(PERMS.WORKSHOP.JOBCARD_MANAGE), async (req, res) => {
  const input = cancelJobCardSchema.parse(req.body);
  const existing = await db.jobCard.findUnique({
    where: { id: getParamId(req) },
    select: { id: true, status: true, branchId: true },
  });
  if (!existing) throw new NotFoundError("Job card not found");
  if (existing.status !== "DRAFT")
    throw new BadRequestError(
      "Only a DRAFT job card can be cancelled — no stock has moved yet at that stage",
    );
  assertBranchAccess(req, existing.branchId);

  await db.jobCard.update({
    where: { id: existing.id },
    data: {
      status: "CANCELLED",
      cancelledById: actorId(req),
      cancelledAt: new Date(),
      cancelReason: input.reason,
    },
  });

  const updated = await db.jobCard.findUnique({
    where: { id: existing.id },
    include: jobCardDetailInclude,
  });
  sendOk(res, updated);
});

const removedPartDetailInclude = {
  sparePart: { select: { id: true, name: true, unit: true } },
  relatedPartLine: { select: { id: true, unitCostPaise: true, batchId: true } },
  newBatch: { select: { id: true, qtyRemaining: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  journalEntry: { select: { id: true, voucherNumber: true, status: true } },
};

router.get("/:id/removed-parts", can(PERMS.WORKSHOP.JOBCARD_VIEW), async (req, res) => {
  const jobCardId = getParamId(req);
  const jobCard = await db.jobCard.findUnique({
    where: { id: jobCardId },
    select: { id: true, branchId: true },
  });
  if (!jobCard) throw new NotFoundError("Job card not found");
  assertBranchAccess(req, jobCard.branchId);

  const rows = await db.jobCardRemovedPart.findMany({
    where: { jobCardId },
    include: removedPartDetailInclude,
    orderBy: { createdAt: "desc" },
  });
  sendOk(res, rows);
});

/**
 * Distinct from Supplier Replacement — this is a part physically removed
 * from the truck during this Job Card, not a defective-part return keyed
 * off a purchase bill. REUSABLE creates a fresh SpareBatch and reverses the
 * original expense (Dr Inventory / Cr Repair Expense); REPAIRABLE/SCRAP are
 * logged only in v1 — no stock or ledger effect.
 */
router.post("/:id/removed-parts", can(PERMS.WORKSHOP.JOBCARD_MANAGE), async (req, res) => {
  const input = createJobCardRemovedPartSchema.parse(req.body);
  const jobCardId = getParamId(req);

  const jobCard = await db.jobCard.findUnique({
    where: { id: jobCardId },
    select: { id: true, branchId: true, fyCode: true, status: true },
  });
  if (!jobCard) throw new NotFoundError("Job card not found");
  if (jobCard.status === "CANCELLED")
    throw new BadRequestError("Cannot record a removed part on a cancelled job card");
  assertBranchAccess(req, jobCard.branchId);

  let relatedLine: { id: string; unitCostPaise: bigint; batchId: string } | null = null;
  if (input.relatedPartLineId) {
    const line = await db.jobCardPartLine.findUnique({
      where: { id: input.relatedPartLineId },
      select: { id: true, jobCardId: true, sparePartId: true, unitCostPaise: true, batchId: true },
    });
    if (!line || line.jobCardId !== jobCardId)
      throw new BadRequestError("relatedPartLineId does not belong to this job card");
    if (line.sparePartId !== input.sparePartId)
      throw new BadRequestError("relatedPartLineId is for a different spare part");
    relatedLine = line;
  }

  if (input.condition === "REUSABLE") {
    const unitCostPaise = input.unitCostPaise ?? relatedLine?.unitCostPaise;
    if (unitCostPaise === undefined || unitCostPaise === 0n)
      throw new BadRequestError(
        "No cost available for this reusable part — the related line isn't finalised yet, or supply unitCostPaise manually",
      );

    const supplierId = relatedLine
      ? (await db.spareBatch.findUnique({ where: { id: relatedLine.batchId }, select: { supplierId: true } }))
        ?.supplierId
      : (await db.sparePart.findUnique({ where: { id: input.sparePartId }, select: { supplierId: true } }))
        ?.supplierId;
    if (!supplierId) throw new BadRequestError("Could not determine a supplier for the returned stock");

    const fyCode = fyCodeFor(new Date());
    const branch = await db.branch.findUnique({
      where: { id: jobCard.branchId },
      select: { branchCode: true },
    });
    if (!branch) throw new BadRequestError("Branch not found");

    const removedPart = await db.$transaction(async (tx) => {
      const batch = await tx.spareBatch.create({
        data: {
          sparePartId: input.sparePartId,
          supplierId,
          branchId: jobCard.branchId,
          qtyReceived: input.qty,
          qtyRemaining: input.qty,
          unitCostPaise,
        },
      });

      const stockLedger = await tx.stockLedger.findUnique({
        where: { sparePartId_branchId: { sparePartId: input.sparePartId, branchId: jobCard.branchId } },
      });
      const oldQty = stockLedger?.currentQty ?? 0;
      const oldAvg = stockLedger?.movingAvgCostPaise ?? 0n;
      const newQty = oldQty + input.qty;
      const newAvg =
        newQty === 0 ? 0n : (oldAvg * BigInt(oldQty) + unitCostPaise * BigInt(input.qty)) / BigInt(newQty);

      await tx.stockLedger.upsert({
        where: { sparePartId_branchId: { sparePartId: input.sparePartId, branchId: jobCard.branchId } },
        create: { sparePartId: input.sparePartId, branchId: jobCard.branchId, currentQty: newQty, movingAvgCostPaise: newAvg },
        update: { currentQty: newQty, movingAvgCostPaise: newAvg },
      });

      const created = await tx.jobCardRemovedPart.create({
        data: {
          jobCardId,
          sparePartId: input.sparePartId,
          relatedPartLineId: input.relatedPartLineId,
          qty: input.qty,
          condition: "REUSABLE",
          unitCostPaise,
          newBatchId: batch.id,
          remarks: input.remarks,
          createdById: actorId(req),
        },
      });

      await tx.stockMovement.create({
        data: {
          sparePartId: input.sparePartId,
          branchId: jobCard.branchId,
          movementType: "RETURN",
          qtyDelta: input.qty,
          unitCostPaise,
          balanceQtyAfter: newQty,
          refType: "JOB_CARD_REMOVED_PART",
          refId: created.id,
          createdById: actorId(req),
        },
      });

      const seq = await nextSequence(tx, branch.branchCode, fyCode, "JCRP");
      const voucherNumber = formatDocNumber(branch.branchCode, fyCode, seq, "SKT/JCRP");
      const amountPaise = unitCostPaise * BigInt(input.qty);

      const voucher = await postPartReturnVoucher(tx, {
        removedPartId: created.id,
        voucherNumber,
        voucherDate: new Date(),
        branchId: jobCard.branchId,
        fyCode,
        amountPaise,
        createdById: actorId(req),
      });

      return tx.jobCardRemovedPart.update({
        where: { id: created.id },
        data: { journalEntryId: voucher.id },
        select: { id: true },
      });
    });

    const result = await db.jobCardRemovedPart.findUnique({
      where: { id: removedPart.id },
      include: removedPartDetailInclude,
    });
    return sendOk(res, result, undefined, 201);
  }

  // REPAIRABLE / SCRAP — log only, no stock or ledger effect in v1.
  const created = await db.jobCardRemovedPart.create({
    data: {
      jobCardId,
      sparePartId: input.sparePartId,
      relatedPartLineId: input.relatedPartLineId,
      qty: input.qty,
      condition: input.condition,
      remarks: input.remarks,
      createdById: actorId(req),
    },
    include: removedPartDetailInclude,
  });
  sendOk(res, created, undefined, 201);
});

export default router;
