import { Router } from "express";
import { PERMS } from "@skerp/types";
import {
  createSpareInwardSchema,
  spareInwardListQuerySchema,
  cancelSpareInwardSchema,
  stockListQuerySchema,
} from "@skerp/validators";
import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { branchFilter, assertBranchAccess } from "../../auth/branch-scope.js";
import { BadRequestError, NotFoundError } from "../../lib/error.js";
import { sendOk } from "../_shared/response.js";
import { getParamId } from "../_shared/param.js";
import { fyCodeFor, formatDocNumber, nextSequence } from "../_shared/doc-number.js";
import { postSpareInwardVoucher, reverseJournal } from "../ledger/posting.service.js";

const router: Router = Router();
router.use(authMiddleware);

const actorId = (req: { user?: { userId: string } }) => req.user!.userId;

const inwardDetailInclude = {
  branch: { select: { id: true, name: true, branchCode: true } },
  supplier: { select: { id: true, name: true, shopName: true } },
  po: { select: { id: true, poNumber: true, status: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  lines: {
    include: {
      sparePart: { select: { id: true, name: true, unit: true } },
      batch: { select: { id: true, batchNo: true, qtyRemaining: true } },
    },
  },
  journalEntry: {
    select: { id: true, voucherNumber: true, status: true, tallySyncStatus: true },
  },
};

router.get("/", can(PERMS.WORKSHOP.INWARD_VIEW), async (req, res) => {
  const query = spareInwardListQuerySchema.parse(req.query);
  const where = {
    ...branchFilter(req),
    ...(query.branchId ? { branchId: query.branchId } : {}),
    ...(query.poId ? { poId: query.poId } : {}),
    ...(query.supplierId ? { supplierId: query.supplierId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
        OR: [
          { inwardNumber: { contains: query.search, mode: "insensitive" as const } },
          { supplierInvoiceNo: { contains: query.search, mode: "insensitive" as const } },
          {
            supplier: {
              name: { contains: query.search, mode: "insensitive" as const },
            },
          },
        ],
      }
      : {}),
  };
  const [inwards, total] = await Promise.all([
    db.spareInward.findMany({
      where,
      include: inwardDetailInclude,
      orderBy: { createdAt: "desc" },
      skip: query.page * query.size,
      take: query.size,
    }),
    db.spareInward.count({ where }),
  ]);
  sendOk(res, inwards, { page: query.page, size: query.size, total });
});

// Stock browse (Task 3) — read-only, no page today shows current qty/branch
// without digging into a PO/Job Card line picker. Ahead of "/:id" so "stock"
// doesn't get swallowed by the :id param route.
router.get("/stock", can(PERMS.WORKSHOP.INWARD_VIEW), async (req, res) => {
  const query = stockListQuerySchema.parse(req.query);
  const where = {
    ...branchFilter(req),
    ...(query.branchId ? { branchId: query.branchId } : {}),
    ...(query.search
      ? { sparePart: { name: { contains: query.search, mode: "insensitive" as const } } }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.stockLedger.findMany({
      where,
      include: {
        sparePart: { select: { id: true, name: true, unit: true, minimumStock: true } },
        branch: { select: { id: true, name: true, branchCode: true } },
      },
      orderBy: [{ branch: { name: "asc" } }, { sparePart: { name: "asc" } }],
      skip: query.page * query.size,
      take: query.size,
    }),
    db.stockLedger.count({ where }),
  ]);
  sendOk(res, rows, { page: query.page, size: query.size, total });
});

// Cheap count for the sidebar "Stock" badge — same below-minimum rule the
// Stock page already flags per-row, just aggregated instead of listed.
router.get("/stock/low-count", can(PERMS.WORKSHOP.INWARD_VIEW), async (req, res) => {
  const rows = await db.stockLedger.findMany({
    where: branchFilter(req),
    select: { currentQty: true, sparePart: { select: { minimumStock: true } } },
  });
  const count = rows.filter((r) => r.currentQty < r.sparePart.minimumStock).length;
  sendOk(res, { count });
});

router.get("/:id", can(PERMS.WORKSHOP.INWARD_VIEW), async (req, res) => {
  const inward = await db.spareInward.findUnique({
    where: { id: getParamId(req) },
    include: inwardDetailInclude,
  });
  if (!inward) throw new NotFoundError("Inward not found");
  sendOk(res, inward);
});

/**
 * Old-ERP behaviour: there is no separate DRAFT-then-post step for Inward —
 * "On Submit, Inventory stock increases." So this single endpoint validates
 * against the PO, receives the goods (stock + batches), and posts the
 * accrual voucher, all in one transaction. Partial receipt is normal — call
 * this endpoint again against the same PO for the remaining quantity.
 */
router.post("/", can(PERMS.WORKSHOP.INWARD_MANAGE), async (req, res) => {
  const input = createSpareInwardSchema.parse(req.body);

  const po = await db.purchaseOrder.findUnique({
    where: { id: input.poId },
    include: { lines: true, branch: { select: { branchCode: true } } },
  });
  if (!po) throw new BadRequestError("Purchase order not found");
  if (!["APPROVED", "SENT", "PARTIALLY_RECEIVED"].includes(po.status))
    throw new BadRequestError(
      "Goods can only be received against an APPROVED, SENT or PARTIALLY_RECEIVED purchase order",
    );
  assertBranchAccess(req, po.branchId);

  const poLineById = new Map(po.lines.map((l) => [l.id, l]));
  for (const line of input.lines) {
    const poLine = poLineById.get(line.poLineId);
    if (!poLine || poLine.sparePartId !== line.sparePartId)
      throw new BadRequestError("A line does not match this purchase order");
    const remaining = poLine.qtyOrdered - poLine.qtyReceived;
    if (line.qtyReceived + line.qtyRejected > remaining)
      throw new BadRequestError(
        `Cannot receive more than the remaining ordered quantity for ${line.sparePartId} (remaining: ${remaining})`,
      );
  }

  const acceptedLines = input.lines.filter((l) => l.qtyReceived > 0);
  const grossAmountPaise = acceptedLines.reduce(
    (sum, l) => sum + l.ratePaise * BigInt(l.qtyReceived),
    0n,
  );
  if (input.discountPaise > grossAmountPaise)
    throw new BadRequestError("Discount cannot exceed the gross amount");
  const payableAmountPaise = grossAmountPaise - input.discountPaise;

  const fyCode = fyCodeFor(input.inwardDate);

  const inward = await db.$transaction(
    async (tx) => {
      // Re-check under the transaction to close the race window on
      // concurrent inwards against the same PO line.
      const freshLines = await tx.purchaseOrderLine.findMany({
        where: { id: { in: input.lines.map((l) => l.poLineId) } },
      });
      const freshById = new Map(freshLines.map((l) => [l.id, l]));
      for (const line of input.lines) {
        const fresh = freshById.get(line.poLineId)!;
        const remaining = fresh.qtyOrdered - fresh.qtyReceived;
        if (line.qtyReceived + line.qtyRejected > remaining)
          throw new BadRequestError(
            "Received quantity now exceeds what remains on the purchase order — someone else may have just posted an inward",
          );
      }

      const seq = await nextSequence(tx, po.branch.branchCode, fyCode, "SINW");
      const inwardNumber = formatDocNumber(po.branch.branchCode, fyCode, seq, "SKT/SINW");

      const created = await tx.spareInward.create({
        data: {
          inwardNumber,
          fyCode,
          branchId: po.branchId,
          poId: po.id,
          supplierId: po.supplierId,
          status: "POSTED",
          inwardDate: input.inwardDate,
          supplierInvoiceNo: input.supplierInvoiceNo,
          supplierInvoiceDate: input.supplierInvoiceDate,
          grossAmountPaise,
          discountPaise: input.discountPaise,
          payableAmountPaise,
          remarks: input.remarks,
          createdById: actorId(req),
          postedById: actorId(req),
          postedAt: new Date(),
          lines: {
            create: input.lines.map((line) => ({
              poLineId: line.poLineId,
              sparePartId: line.sparePartId,
              qtyReceived: line.qtyReceived,
              qtyRejected: line.qtyRejected,
              ratePaise: line.ratePaise,
              amountPaise: line.ratePaise * BigInt(line.qtyReceived),
              batchNo: line.batchNo,
              warrantyExpiry: line.warrantyExpiry,
              guaranteeExpiry: line.guaranteeExpiry,
            })),
          },
        },
        include: { lines: true },
      });

      // Stock: one batch + one StockMovement per accepted line, moving-avg
      // recompute on StockLedger. Previously this was a for-loop awaiting 5
      // separate round trips per line, sequentially — with N lines that's up
      // to 5N round trips one after another. Grouped by sparePartId (almost
      // always 1:1 with lines, but this stays correct even if two lines
      // target the same part) so the ledger read/upsert happens once per
      // part instead of once per line, and batch/movement inserts + PO-line
      // updates all fire together via Promise.all instead of one at a time.
      const acceptedCreatedLines = created.lines.filter((line) => line.qtyReceived > 0);
      const linesBySparePart = new Map<string, typeof acceptedCreatedLines>();
      for (const line of acceptedCreatedLines) {
        const list = linesBySparePart.get(line.sparePartId) ?? [];
        list.push(line);
        linesBySparePart.set(line.sparePartId, list);
      }

      const existingLedgers = await tx.stockLedger.findMany({
        where: {
          branchId: po.branchId,
          sparePartId: { in: [...linesBySparePart.keys()] },
        },
      });
      const ledgerByPart = new Map(
        existingLedgers.map((ledger) => [ledger.sparePartId, ledger]),
      );

      const stockMovementsData: {
        sparePartId: string;
        branchId: string;
        movementType: "INWARD";
        qtyDelta: number;
        unitCostPaise: bigint;
        balanceQtyAfter: number;
        refType: "SPARE_INWARD";
        refId: string;
        createdById: string;
      }[] = [];
      const ledgerUpserts: ReturnType<typeof tx.stockLedger.upsert>[] = [];
      const poLineUpdates: ReturnType<typeof tx.purchaseOrderLine.update>[] = [];

      for (const [sparePartId, partLines] of linesBySparePart) {
        const existing = ledgerByPart.get(sparePartId);
        let qty = existing?.currentQty ?? 0;
        let avg = existing?.movingAvgCostPaise ?? 0n;

        for (const line of partLines) {
          const newQty = qty + line.qtyReceived;
          avg =
            newQty === 0
              ? 0n
              : (avg * BigInt(qty) + line.ratePaise * BigInt(line.qtyReceived)) /
                BigInt(newQty);
          qty = newQty;

          stockMovementsData.push({
            sparePartId,
            branchId: po.branchId,
            movementType: "INWARD",
            qtyDelta: line.qtyReceived,
            unitCostPaise: line.ratePaise,
            balanceQtyAfter: qty,
            refType: "SPARE_INWARD",
            refId: created.id,
            createdById: actorId(req),
          });

          poLineUpdates.push(
            tx.purchaseOrderLine.update({
              where: { id: line.poLineId },
              data: { qtyReceived: { increment: line.qtyReceived } },
            }),
          );
        }

        ledgerUpserts.push(
          tx.stockLedger.upsert({
            where: { sparePartId_branchId: { sparePartId, branchId: po.branchId } },
            create: {
              sparePartId,
              branchId: po.branchId,
              currentQty: qty,
              movingAvgCostPaise: avg,
            },
            update: { currentQty: qty, movingAvgCostPaise: avg },
          }),
        );
      }

      await Promise.all([
        tx.spareBatch.createMany({
          data: acceptedCreatedLines.map((line) => ({
            sparePartId: line.sparePartId,
            supplierId: po.supplierId,
            branchId: po.branchId,
            inwardLineId: line.id,
            batchNo: line.batchNo,
            qtyReceived: line.qtyReceived,
            qtyRemaining: line.qtyReceived,
            unitCostPaise: line.ratePaise,
            warrantyExpiry: line.warrantyExpiry,
            guaranteeExpiry: line.guaranteeExpiry,
          })),
        }),
        tx.stockMovement.createMany({ data: stockMovementsData }),
        ...ledgerUpserts,
        ...poLineUpdates,
      ]);

      // Roll up PO status from its (now-updated) lines.
      const updatedLines = await tx.purchaseOrderLine.findMany({ where: { poId: po.id } });
      const fullyReceived = updatedLines.every((l) => l.qtyReceived >= l.qtyOrdered);
      const anyReceived = updatedLines.some((l) => l.qtyReceived > 0);
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: fullyReceived ? "RECEIVED" : anyReceived ? "PARTIALLY_RECEIVED" : po.status },
      });

      const voucher = await postSpareInwardVoucher(tx, {
        inwardId: created.id,
        inwardNumber: created.inwardNumber!,
        inwardDate: created.inwardDate,
        branchId: created.branchId,
        fyCode: created.fyCode,
        supplierId: created.supplierId,
        payableAmountPaise: created.payableAmountPaise,
        createdById: actorId(req),
      });

      await tx.spareInward.update({
        where: { id: created.id },
        data: { journalEntryId: voucher.id },
      });

      return created;
    },

  );

  const result = await db.spareInward.findUnique({
    where: { id: inward.id },
    include: inwardDetailInclude,
  });
  sendOk(res, result, undefined, 201);
});

router.post("/:id/cancel", can(PERMS.WORKSHOP.INWARD_MANAGE), async (req, res) => {
  const input = cancelSpareInwardSchema.parse(req.body);
  const existing = await db.spareInward.findUnique({
    where: { id: getParamId(req) },
    include: { lines: true },
  });
  if (!existing) throw new NotFoundError("Inward not found");
  if (existing.status !== "POSTED")
    throw new BadRequestError("Only a POSTED inward can be cancelled");
  assertBranchAccess(req, existing.branchId);

  await db.$transaction(
    async (tx) => {
      for (const line of existing.lines) {
        if (line.qtyReceived <= 0) continue;

        const batch = await tx.spareBatch.findUnique({ where: { inwardLineId: line.id } });
        if (batch && batch.qtyRemaining !== batch.qtyReceived)
          throw new BadRequestError(
            "This inward cannot be cancelled — part of its batch has already been issued",
          );

        const stockLedger = await tx.stockLedger.findUnique({
          where: { sparePartId_branchId: { sparePartId: line.sparePartId, branchId: existing.branchId } },
        });
        if (!stockLedger) continue;
        const newQty = stockLedger.currentQty - line.qtyReceived;

        await tx.stockLedger.update({
          where: { sparePartId_branchId: { sparePartId: line.sparePartId, branchId: existing.branchId } },
          data: { currentQty: newQty },
        });

        await tx.stockMovement.create({
          data: {
            sparePartId: line.sparePartId,
            branchId: existing.branchId,
            movementType: "ADJUSTMENT",
            qtyDelta: -line.qtyReceived,
            unitCostPaise: line.ratePaise,
            balanceQtyAfter: newQty,
            refType: "SPARE_INWARD_CANCEL",
            refId: existing.id,
            createdById: actorId(req),
          },
        });

        if (batch) await tx.spareBatch.delete({ where: { id: batch.id } });

        await tx.purchaseOrderLine.update({
          where: { id: line.poLineId },
          data: { qtyReceived: { decrement: line.qtyReceived } },
        });
      }

      const updatedLines = await tx.purchaseOrderLine.findMany({ where: { poId: existing.poId } });
      const anyReceived = updatedLines.some((l) => l.qtyReceived > 0);
      await tx.purchaseOrder.update({
        where: { id: existing.poId },
        data: { status: anyReceived ? "PARTIALLY_RECEIVED" : "APPROVED" },
      });

      if (existing.journalEntryId)
        await reverseJournal(tx, existing.journalEntryId, input.reason, actorId(req));

      await tx.spareInward.update({
        where: { id: existing.id },
        data: {
          status: "CANCELLED",
          cancelledById: actorId(req),
          cancelledAt: new Date(),
          cancelReason: input.reason,
        },
      });
    },
  );

  const updated = await db.spareInward.findUnique({
    where: { id: existing.id },
    include: inwardDetailInclude,
  });
  sendOk(res, updated);
});

export default router;
