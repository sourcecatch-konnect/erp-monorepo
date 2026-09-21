import { Router } from "express";
import { PERMS } from "@skerp/types";
import {
  createReplacementListSchema,
  replacementListQuerySchema,
  cancelReplacementListSchema,
  createReplacementInwardSchema,
  replacementInwardQuerySchema,
  createReplacementCreditNoteSchema,
} from "@skerp/validators";
import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { branchFilter, assertBranchAccess } from "../../auth/branch-scope.js";
import { BadRequestError, NotFoundError } from "../../lib/error.js";
import { sendOk } from "../_shared/response.js";
import { getParamId } from "../_shared/param.js";
import { fyCodeFor, formatDocNumber, nextSequence } from "../_shared/doc-number.js";
import { postReplacementInwardVoucher, postReplacementCreditNoteVoucher } from "../ledger/posting.service.js";

const router: Router = Router();
router.use(authMiddleware);

const actorId = (req: { user?: { userId: string } }) => req.user!.userId;

/* ------------------------------------------------------------------ */
/* Replacement List (outward — the defective part goes back)          */
/* ------------------------------------------------------------------ */

const listDetailInclude = {
  branch: { select: { id: true, name: true, branchCode: true } },
  supplier: { select: { id: true, name: true, shopName: true } },
  originalInward: { select: { id: true, inwardNumber: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  lines: {
    include: {
      sparePart: { select: { id: true, name: true, unit: true } },
      originalBatch: { select: { id: true, batchNo: true, unitCostPaise: true } },
    },
  },
};

router.get("/replacement-list", can(PERMS.WORKSHOP.REPLACEMENT_VIEW), async (req, res) => {
  const query = replacementListQuerySchema.parse(req.query);
  const where = {
    ...branchFilter(req),
    ...(query.branchId ? { branchId: query.branchId } : {}),
    ...(query.supplierId ? { supplierId: query.supplierId } : {}),
    ...(query.status ? { status: query.status } : {}),
  };
  const [lists, total] = await Promise.all([
    db.replacementList.findMany({
      where,
      include: listDetailInclude,
      orderBy: { createdAt: "desc" },
      skip: query.page * query.size,
      take: query.size,
    }),
    db.replacementList.count({ where }),
  ]);
  sendOk(res, lists, { page: query.page, size: query.size, total });
});

router.get("/replacement-list/:id", can(PERMS.WORKSHOP.REPLACEMENT_VIEW), async (req, res) => {
  const list = await db.replacementList.findUnique({
    where: { id: getParamId(req) },
    include: listDetailInclude,
  });
  if (!list) throw new NotFoundError("Replacement list not found");
  sendOk(res, list);
});

/**
 * The defective part(s) leave the workshop here — the original batch's
 * qtyRemaining is decremented immediately (it's physically gone). No ledger
 * entry yet: the part's value is already on the books from the original
 * purchase and hasn't changed hands financially, only physically.
 */
router.post("/replacement-list", can(PERMS.WORKSHOP.REPLACEMENT_MANAGE), async (req, res) => {
  const input = createReplacementListSchema.parse(req.body);
  assertBranchAccess(req, input.branchId);

  const originalInward = await db.spareInward.findUnique({
    where: { id: input.originalInwardId },
    select: { id: true, supplierId: true, branchId: true },
  });
  if (!originalInward) throw new BadRequestError("Original inward not found");
  if (originalInward.supplierId !== input.supplierId)
    throw new BadRequestError("Original inward does not belong to this supplier");

  const inwardLineIds = input.lines.map((l) => l.originalInwardLineId);
  const inwardLines = await db.purchaseOrderInwardLine.findMany({
    where: { id: { in: inwardLineIds } },
    include: { batch: true },
  });
  const lineById = new Map(inwardLines.map((l) => [l.id, l]));

  for (const line of input.lines) {
    const inwardLine = lineById.get(line.originalInwardLineId);
    if (!inwardLine || inwardLine.inwardId !== input.originalInwardId)
      throw new BadRequestError("A line does not belong to the selected original inward");
    if (inwardLine.sparePartId !== line.sparePartId)
      throw new BadRequestError("A line's spare part does not match its original inward line");
    if (!inwardLine.batch)
      throw new BadRequestError("The original inward line has no stock batch to replace from");
    if (inwardLine.batch.qtyRemaining < line.qtyRequested)
      throw new BadRequestError(
        `Not enough stock remaining in the original batch for ${line.sparePartId} (available: ${inwardLine.batch.qtyRemaining}, requested: ${line.qtyRequested})`,
      );
  }

  const branch = await db.branch.findUnique({
    where: { id: input.branchId },
    select: { branchCode: true },
  });
  if (!branch) throw new BadRequestError("Branch not found");
  const fyCode = fyCodeFor(input.requestDate);

  const seq = await nextSequence(db, branch.branchCode, fyCode, "RPL");
  const replacementNumber = formatDocNumber(branch.branchCode, fyCode, seq, "SKT/RPL");

  const list = await db.$transaction(async (tx) => {
    // Re-check batch quantities under the transaction against a concurrent
    // request/issue touching the same batch.
    const freshBatches = await tx.spareBatch.findMany({
      where: { id: { in: inwardLines.map((l) => l.batch!.id) } },
    });
    const freshBatchById = new Map(freshBatches.map((b) => [b.id, b]));
    for (const line of input.lines) {
      const inwardLine = lineById.get(line.originalInwardLineId)!;
      const fresh = freshBatchById.get(inwardLine.batch!.id)!;
      if (fresh.qtyRemaining < line.qtyRequested)
        throw new BadRequestError(
          "Stock in the original batch has changed since you loaded this form — refresh and try again",
        );
    }

    const created = await tx.replacementList.create({
      data: {
        replacementNumber,
        fyCode,
        branchId: input.branchId,
        supplierId: input.supplierId,
        originalInwardId: input.originalInwardId,
        requestDate: input.requestDate,
        remarks: input.remarks,
        createdById: actorId(req),
        lines: {
          create: input.lines.map((line) => ({
            sparePartId: line.sparePartId,
            originalInwardLineId: line.originalInwardLineId,
            originalBatchId: lineById.get(line.originalInwardLineId)!.batch!.id,
            qtyRequested: line.qtyRequested,
            replacementType: line.replacementType,
            remarks: line.remarks,
          })),
        },
      },
      include: { lines: true },
    });

    // Per line, the batch decrement and ledger decrement are independent —
    // run them together, then the movement row (needs the ledger's new
    // balance). Lines themselves are independent of each other (distinct
    // batches/parts), so run all lines in parallel too — this replaces what
    // was N sequential read-then-write round-trips with ~2 round-trips total.
    await Promise.all(
      created.lines.map(async (line) => {
        const batch = freshBatchById.get(line.originalBatchId)!;

        const [, updatedLedger] = await Promise.all([
          tx.spareBatch.update({
            where: { id: batch.id },
            data: { qtyRemaining: { decrement: line.qtyRequested } },
          }),
          tx.stockLedger.upsert({
            where: { sparePartId_branchId: { sparePartId: line.sparePartId, branchId: input.branchId } },
            create: {
              sparePartId: line.sparePartId,
              branchId: input.branchId,
              currentQty: -line.qtyRequested,
            },
            update: { currentQty: { decrement: line.qtyRequested } },
          }),
        ]);

        await tx.stockMovement.create({
          data: {
            sparePartId: line.sparePartId,
            branchId: input.branchId,
            movementType: "ADJUSTMENT",
            qtyDelta: -line.qtyRequested,
            unitCostPaise: batch.unitCostPaise,
            balanceQtyAfter: updatedLedger.currentQty,
            refType: "REPLACEMENT_OUTWARD",
            refId: created.id,
            createdById: actorId(req),
          },
        });
      }),
    );

    return created;
  });

  const result = await db.replacementList.findUnique({
    where: { id: list.id },
    include: listDetailInclude,
  });
  sendOk(res, result, undefined, 201);
});

/**
 * Only allowed while nothing has come back yet — reverses the outward
 * stock movement so the original batch is made whole again.
 */
router.post(
  "/replacement-list/:id/cancel",
  can(PERMS.WORKSHOP.REPLACEMENT_MANAGE),
  async (req, res) => {
    const input = cancelReplacementListSchema.parse(req.body);
    const existing = await db.replacementList.findUnique({
      where: { id: getParamId(req) },
      include: { lines: true },
    });
    if (!existing) throw new NotFoundError("Replacement list not found");
    if (existing.status !== "PENDING")
      throw new BadRequestError(
        "Only a PENDING replacement list with nothing received yet can be cancelled",
      );
    assertBranchAccess(req, existing.branchId);

    await db.$transaction(async (tx) => {
      for (const line of existing.lines) {
        await tx.spareBatch.update({
          where: { id: line.originalBatchId },
          data: { qtyRemaining: { increment: line.qtyRequested } },
        });

        const stockLedger = await tx.stockLedger.findUnique({
          where: { sparePartId_branchId: { sparePartId: line.sparePartId, branchId: existing.branchId } },
        });
        const newQty = (stockLedger?.currentQty ?? 0) + line.qtyRequested;

        await tx.stockLedger.update({
          where: { sparePartId_branchId: { sparePartId: line.sparePartId, branchId: existing.branchId } },
          data: { currentQty: newQty },
        });

        await tx.stockMovement.create({
          data: {
            sparePartId: line.sparePartId,
            branchId: existing.branchId,
            movementType: "ADJUSTMENT",
            qtyDelta: line.qtyRequested,
            unitCostPaise: 0n,
            balanceQtyAfter: newQty,
            refType: "REPLACEMENT_OUTWARD_CANCEL",
            refId: existing.id,
            createdById: actorId(req),
          },
        });
      }

      await tx.replacementList.update({
        where: { id: existing.id },
        data: {
          status: "CANCELLED",
          cancelledById: actorId(req),
          cancelledAt: new Date(),
          cancelReason: input.reason,
        },
      });
    });

    const updated = await db.replacementList.findUnique({
      where: { id: existing.id },
      include: listDetailInclude,
    });
    sendOk(res, updated);
  },
);

/* ------------------------------------------------------------------ */
/* Replacement Inward (the replacement part comes back)                */
/* ------------------------------------------------------------------ */

const inwardDetailInclude = {
  branch: { select: { id: true, name: true, branchCode: true } },
  supplier: { select: { id: true, name: true, shopName: true } },
  replacementList: { select: { id: true, replacementNumber: true, status: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  lines: {
    include: {
      sparePart: { select: { id: true, name: true, unit: true } },
      newBatch: { select: { id: true, batchNo: true, qtyRemaining: true } },
    },
  },
  journalEntry: {
    select: { id: true, voucherNumber: true, status: true, tallySyncStatus: true },
  },
};

router.get("/replacement-inward", can(PERMS.WORKSHOP.REPLACEMENT_VIEW), async (req, res) => {
  const query = replacementInwardQuerySchema.parse(req.query);
  const where = {
    ...branchFilter(req),
    ...(query.branchId ? { branchId: query.branchId } : {}),
    ...(query.replacementListId ? { replacementListId: query.replacementListId } : {}),
  };
  const [inwards, total] = await Promise.all([
    db.replacementInward.findMany({
      where,
      include: inwardDetailInclude,
      orderBy: { createdAt: "desc" },
      skip: query.page * query.size,
      take: query.size,
    }),
    db.replacementInward.count({ where }),
  ]);
  sendOk(res, inwards, { page: query.page, size: query.size, total });
});

router.get("/replacement-inward/:id", can(PERMS.WORKSHOP.REPLACEMENT_VIEW), async (req, res) => {
  const inward = await db.replacementInward.findUnique({
    where: { id: getParamId(req) },
    include: inwardDetailInclude,
  });
  if (!inward) throw new NotFoundError("Replacement inward not found");
  sendOk(res, inward);
});

/**
 * Single-step submit, same as Purchase Inward. Creates a fresh SpareBatch
 * per line at (original cost + differential); only the differential ever
 * posts to the ledger (see postReplacementInwardVoucher).
 */
router.post("/replacement-inward", can(PERMS.WORKSHOP.REPLACEMENT_MANAGE), async (req, res) => {
  const input = createReplacementInwardSchema.parse(req.body);

  const list = await db.replacementList.findUnique({
    where: { id: input.replacementListId },
    include: { lines: { include: { originalBatch: true } } },
  });
  if (!list) throw new BadRequestError("Replacement list not found");
  if (!["PENDING", "PARTIALLY_RECEIVED"].includes(list.status))
    throw new BadRequestError("This replacement list is not open to receive against");
  assertBranchAccess(req, list.branchId);

  const listLineById = new Map(list.lines.map((l) => [l.id, l]));
  for (const line of input.lines) {
    const listLine = listLineById.get(line.replacementListLineId);
    if (!listLine)
      throw new BadRequestError("A line does not belong to the selected replacement list");
    const remaining = listLine.qtyRequested - listLine.qtyReceived;
    if (line.qtyReceived > remaining)
      throw new BadRequestError(
        `Cannot receive more than what's pending for ${listLine.sparePartId} (pending: ${remaining})`,
      );
    if (listLine.replacementType === "FREE" && line.differentialRatePaise > 0n)
      throw new BadRequestError("A FREE replacement line cannot carry a differential charge");
    if (listLine.replacementType === "CREDIT_NOTE")
      throw new BadRequestError(
        "A CREDIT_NOTE line never gets a physical batch back — settle it via /replacement-list/:id/credit-note",
      );
  }

  const branch = await db.branch.findUnique({
    where: { id: list.branchId },
    select: { branchCode: true },
  });
  if (!branch) throw new BadRequestError("Branch not found");
  const fyCode = fyCodeFor(input.inwardDate);

  const seq = await nextSequence(db, branch.branchCode, fyCode, "RPLINW");
  const replacementInwardNumber = formatDocNumber(branch.branchCode, fyCode, seq, "SKT/RPLINW");

  const inward = await db.$transaction(async (tx) => {
    const freshLines = await tx.replacementListLine.findMany({
      where: { id: { in: input.lines.map((l) => l.replacementListLineId) } },
    });
    const freshById = new Map(freshLines.map((l) => [l.id, l]));
    for (const line of input.lines) {
      const fresh = freshById.get(line.replacementListLineId)!;
      const remaining = fresh.qtyRequested - fresh.qtyReceived;
      if (line.qtyReceived > remaining)
        throw new BadRequestError(
          "Pending quantity has changed since you loaded this form — refresh and try again",
        );
    }

    const created = await tx.replacementInward.create({
      data: {
        replacementInwardNumber,
        fyCode,
        branchId: list.branchId,
        replacementListId: list.id,
        supplierId: list.supplierId,
        status: "POSTED",
        inwardDate: input.inwardDate,
        supplierChallanNo: input.supplierChallanNo,
        supplierChallanDate: input.supplierChallanDate,
        remarks: input.remarks,
        createdById: actorId(req),
        postedById: actorId(req),
        postedAt: new Date(),
        lines: {
          create: input.lines.map((line) => {
            const listLine = listLineById.get(line.replacementListLineId)!;
            return {
              replacementListLineId: line.replacementListLineId,
              sparePartId: listLine.sparePartId,
              qtyReceived: line.qtyReceived,
              differentialRatePaise: line.differentialRatePaise,
              differentialAmountPaise: line.differentialRatePaise * BigInt(line.qtyReceived),
              batchNo: line.batchNo,
              warrantyExpiry: line.warrantyExpiry,
              guaranteeExpiry: line.guaranteeExpiry,
            };
          }),
        },
      },
      include: { lines: true },
    });

    let differentialAmountPaise = 0n;

    // Moving-average cost needs a read of the current ledger before writing
    // its new value, so lines stay sequential when they might share the same
    // sparePartId+branchId (avoids a lost-update race on the average calc).
    // Everything else per line (batch create, line link-back, movement,
    // list-line increment) is independent and runs in parallel.
    for (const line of created.lines) {
      const listLine = listLineById.get(line.replacementListLineId)!;
      const batchUnitCost = listLine.originalBatch.unitCostPaise + line.differentialRatePaise;
      differentialAmountPaise += line.differentialAmountPaise;

      const [newBatch, stockLedger] = await Promise.all([
        tx.spareBatch.create({
          data: {
            sparePartId: line.sparePartId,
            supplierId: list.supplierId,
            branchId: list.branchId,
            qtyReceived: line.qtyReceived,
            qtyRemaining: line.qtyReceived,
            unitCostPaise: batchUnitCost,
            batchNo: line.batchNo,
            warrantyExpiry: line.warrantyExpiry,
            guaranteeExpiry: line.guaranteeExpiry,
          },
        }),
        tx.stockLedger.findUnique({
          where: { sparePartId_branchId: { sparePartId: line.sparePartId, branchId: list.branchId } },
        }),
      ]);

      const oldQty = stockLedger?.currentQty ?? 0;
      const oldAvg = stockLedger?.movingAvgCostPaise ?? 0n;
      const newQty = oldQty + line.qtyReceived;
      const newAvg =
        newQty === 0
          ? 0n
          : (oldAvg * BigInt(oldQty) + batchUnitCost * BigInt(line.qtyReceived)) / BigInt(newQty);

      await Promise.all([
        tx.replacementInwardLine.update({
          where: { id: line.id },
          data: { newBatchId: newBatch.id },
        }),
        tx.stockLedger.upsert({
          where: { sparePartId_branchId: { sparePartId: line.sparePartId, branchId: list.branchId } },
          create: { sparePartId: line.sparePartId, branchId: list.branchId, currentQty: newQty, movingAvgCostPaise: newAvg },
          update: { currentQty: newQty, movingAvgCostPaise: newAvg },
        }),
        tx.stockMovement.create({
          data: {
            sparePartId: line.sparePartId,
            branchId: list.branchId,
            movementType: "INWARD",
            qtyDelta: line.qtyReceived,
            unitCostPaise: batchUnitCost,
            balanceQtyAfter: newQty,
            refType: "REPLACEMENT_INWARD",
            refId: created.id,
            createdById: actorId(req),
          },
        }),
        tx.replacementListLine.update({
          where: { id: line.replacementListLineId },
          data: { qtyReceived: { increment: line.qtyReceived } },
        }),
      ]);
    }

    const updatedListLines = await tx.replacementListLine.findMany({
      where: { replacementListId: list.id },
    });
    const fullyReceived = updatedListLines.every((l) => l.qtyReceived >= l.qtyRequested);
    const anyReceived = updatedListLines.some((l) => l.qtyReceived > 0);
    await tx.replacementList.update({
      where: { id: list.id },
      data: { status: fullyReceived ? "RECEIVED" : anyReceived ? "PARTIALLY_RECEIVED" : list.status },
    });

    let journalEntryId: string | null = null;
    if (differentialAmountPaise > 0n) {
      const voucher = await postReplacementInwardVoucher(tx, {
        replacementInwardId: created.id,
        replacementInwardNumber: created.replacementInwardNumber!,
        inwardDate: input.inwardDate,
        branchId: list.branchId,
        fyCode,
        supplierId: list.supplierId,
        differentialAmountPaise,
        createdById: actorId(req),
      });
      journalEntryId = voucher.id;
    }

    return tx.replacementInward.update({
      where: { id: created.id },
      data: { differentialAmountPaise, journalEntryId },
      select: { id: true },
    });
  });

  const result = await db.replacementInward.findUnique({
    where: { id: inward.id },
    include: inwardDetailInclude,
  });
  sendOk(res, result, undefined, 201);
});

/**
 * CREDIT_NOTE lines never receive a physical batch (nothing to "Receive"),
 * so this is a dedicated endpoint rather than a branch of
 * /replacement-inward: it takes an amount per line and posts one voucher
 * (postReplacementCreditNoteVoucher), then marks those list lines settled by
 * setting qtyReceived = qtyRequested — there is no quantity to track for a
 * line that never physically comes back, so "received" here just means
 * "settled/closed".
 */
router.post(
  "/replacement-list/:id/credit-note",
  can(PERMS.WORKSHOP.REPLACEMENT_MANAGE),
  async (req, res) => {
    const input = createReplacementCreditNoteSchema.parse(req.body);
    const listId = getParamId(req);

    const list = await db.replacementList.findUnique({
      where: { id: listId },
      include: { lines: true },
    });
    if (!list) throw new NotFoundError("Replacement list not found");
    if (!["PENDING", "PARTIALLY_RECEIVED"].includes(list.status))
      throw new BadRequestError("This replacement list is not open to settle against");
    assertBranchAccess(req, list.branchId);

    const listLineById = new Map(list.lines.map((l) => [l.id, l]));
    let totalAmountPaise = 0n;
    for (const line of input.lines) {
      const listLine = listLineById.get(line.replacementListLineId);
      if (!listLine)
        throw new BadRequestError("A line does not belong to the selected replacement list");
      if (listLine.replacementType !== "CREDIT_NOTE")
        throw new BadRequestError("Only CREDIT_NOTE lines can be settled through this endpoint");
      if (listLine.qtyReceived >= listLine.qtyRequested)
        throw new BadRequestError("This line has already been settled");
      totalAmountPaise += line.amountPaise;
    }

    const branch = await db.branch.findUnique({
      where: { id: list.branchId },
      select: { branchCode: true },
    });
    if (!branch) throw new BadRequestError("Branch not found");
    const fyCode = fyCodeFor(input.creditNoteDate);

    const seq = await nextSequence(db, branch.branchCode, fyCode, "RPLCN");
    const voucherNumber = formatDocNumber(branch.branchCode, fyCode, seq, "SKT/RPLCN");

    await db.$transaction(async (tx) => {
      const freshLines = await tx.replacementListLine.findMany({
        where: { id: { in: input.lines.map((l) => l.replacementListLineId) } },
      });
      const freshById = new Map(freshLines.map((l) => [l.id, l]));
      for (const line of input.lines) {
        const fresh = freshById.get(line.replacementListLineId)!;
        if (fresh.qtyReceived >= fresh.qtyRequested)
          throw new BadRequestError(
            "Pending status has changed since you loaded this form — refresh and try again",
          );
      }

      await Promise.all(
        input.lines.map((line) => {
          const listLine = listLineById.get(line.replacementListLineId)!;
          return tx.replacementListLine.update({
            where: { id: line.replacementListLineId },
            data: { qtyReceived: listLine.qtyRequested },
          });
        }),
      );

      await postReplacementCreditNoteVoucher(tx, {
        replacementListId: list.id,
        voucherNumber,
        creditNoteDate: input.creditNoteDate,
        branchId: list.branchId,
        fyCode,
        supplierId: list.supplierId,
        amountPaise: totalAmountPaise,
        createdById: actorId(req),
      });

      const updatedListLines = await tx.replacementListLine.findMany({
        where: { replacementListId: list.id },
      });
      const fullyReceived = updatedListLines.every((l) => l.qtyReceived >= l.qtyRequested);
      await tx.replacementList.update({
        where: { id: list.id },
        data: { status: fullyReceived ? "RECEIVED" : "PARTIALLY_RECEIVED" },
      });
    });

    const result = await db.replacementList.findUnique({
      where: { id: list.id },
      include: listDetailInclude,
    });
    sendOk(res, result, undefined, 201);
  },
);

export default router;
