import { Router } from "express";
import { PERMS } from "@skerp/types";
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  purchaseOrderListQuerySchema,
  cancelPurchaseOrderSchema,
} from "@skerp/validators";
import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { branchFilter, assertBranchAccess } from "../../auth/branch-scope.js";
import { BadRequestError, NotFoundError } from "../../lib/error.js";
import { sendOk } from "../_shared/response.js";
import { getParamId } from "../_shared/param.js";
import { fyCodeFor, formatDocNumber, nextSequence } from "../_shared/doc-number.js";

const router: Router = Router();
router.use(authMiddleware);

const actorId = (req: { user?: { userId: string } }) => req.user!.userId;

const poDetailInclude = {
  branch: { select: { id: true, name: true, branchCode: true } },
  supplier: { select: { id: true, name: true, shopName: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  approvedBy: { select: { id: true, firstName: true, lastName: true } },
  lines: {
    include: { sparePart: { select: { id: true, name: true, unit: true } } },
    orderBy: { lineNumber: "asc" as const },
  },
};

router.get("/", can(PERMS.WORKSHOP.PO_VIEW), async (req, res) => {
  const query = purchaseOrderListQuerySchema.parse(req.query);
  const where = {
    ...branchFilter(req),
    ...(query.branchId ? { branchId: query.branchId } : {}),
    ...(query.supplierId ? { supplierId: query.supplierId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
        OR: [
          { poNumber: { contains: query.search, mode: "insensitive" as const } },
          {
            supplier: {
              name: { contains: query.search, mode: "insensitive" as const },
            },
          },
        ],
      }
      : {}),
  };

  const [orders, total] = await Promise.all([
    db.purchaseOrder.findMany({
      where,
      include: poDetailInclude,
      orderBy: { createdAt: "desc" },
      skip: query.page * query.size,
      take: query.size,
    }),
    db.purchaseOrder.count({ where }),
  ]);
  sendOk(res, orders, { page: query.page, size: query.size, total });
});

/**
 * Spare parts with their current stock at one branch + reorder threshold —
 * feeds the PO line picker so a buyer can see "in stock: 12 (min: 50)"
 * instead of a bare name. Purchase Order itself never moves stock; this is
 * read-only context, nothing here is decremented by placing an order.
 */
router.get("/lookup/spare-parts", can(PERMS.WORKSHOP.PO_VIEW), async (req, res) => {
  const branchId = String(req.query.branchId ?? "");
  const search = req.query.search ? String(req.query.search) : undefined;

  const parts = await db.sparePart.findMany({
    where: search ? { name: { contains: search, mode: "insensitive" as const } } : undefined,
    select: { id: true, name: true, unit: true, minimumStock: true, rate: true },
    orderBy: { name: "asc" },
    take: 20,
  });

  const stockLedgers = branchId
    ? await db.stockLedger.findMany({
      where: { branchId, sparePartId: { in: parts.map((p) => p.id) } },
      select: { sparePartId: true, currentQty: true },
    })
    : [];
  const stockByPart = new Map(stockLedgers.map((s) => [s.sparePartId, s.currentQty]));

  sendOk(
    res,
    parts.map((p) => ({
      id: p.id,
      name: p.name,
      unit: p.unit,
      minimumStock: p.minimumStock,
      ratePaise: p.rate,
      currentStock: branchId ? (stockByPart.get(p.id) ?? 0) : null,
    })),
  );
});

router.get("/:id", can(PERMS.WORKSHOP.PO_VIEW), async (req, res) => {
  const po = await db.purchaseOrder.findUnique({
    where: { id: getParamId(req) },
    include: poDetailInclude,
  });
  if (!po) throw new NotFoundError("Purchase order not found");
  sendOk(res, po);
});

router.post("/", can(PERMS.WORKSHOP.PO_MANAGE), async (req, res) => {
  const input = createPurchaseOrderSchema.parse(req.body);
  assertBranchAccess(req, input.branchId);

  const supplier = await db.sparePartSupplier.findUnique({
    where: { id: input.supplierId },
    select: { id: true },
  });
  if (!supplier) throw new BadRequestError("Supplier not found");

  const sparePartIds = input.lines.map((l) => l.sparePartId);
  const parts = await db.sparePart.findMany({
    where: { id: { in: sparePartIds } },
    select: { id: true },
  });
  if (parts.length !== new Set(sparePartIds).size)
    throw new BadRequestError("One or more spare parts not found");

  const branch = await db.branch.findUnique({
    where: { id: input.branchId },
    select: { branchCode: true },
  });
  if (!branch) throw new BadRequestError("Branch not found");

  const fyCode = fyCodeFor(input.poDate);
  const lines = input.lines.map((line) => ({
    ...line,
    amountPaise: line.ratePaise * BigInt(line.qtyOrdered),
  }));
  const estimatedPaise = lines.reduce((sum, l) => sum + l.amountPaise, 0n);

  const po = await db.$transaction(
    async (tx) => {
      const seq = await nextSequence(tx, branch.branchCode, fyCode, "PO");
      const poNumber = formatDocNumber(branch.branchCode, fyCode, seq, "SKT/PO");

      return tx.purchaseOrder.create({
        data: {
          poNumber,
          fyCode,
          branchId: input.branchId,
          supplierId: input.supplierId,
          poDate: input.poDate,
          expectedDate: input.expectedDate,
          remarks: input.remarks,
          estimatedPaise,
          createdById: actorId(req),
          lines: {
            create: lines.map((line, index) => ({
              lineNumber: index + 1,
              sparePartId: line.sparePartId,
              qtyOrdered: line.qtyOrdered,
              ratePaise: line.ratePaise,
              amountPaise: line.amountPaise,
            })),
          },
        },
        select: { id: true },
      });
    },

  );

  const created = await db.purchaseOrder.findUnique({
    where: { id: po.id },
    include: poDetailInclude,
  });
  sendOk(res, created, undefined, 201);
});

router.patch("/:id", can(PERMS.WORKSHOP.PO_MANAGE), async (req, res) => {
  const input = updatePurchaseOrderSchema.parse(req.body);

  const existing = await db.purchaseOrder.findUnique({
    where: { id: getParamId(req) },
    select: { id: true, status: true, branchId: true, poDate: true },
  });
  if (!existing) throw new NotFoundError("Purchase order not found");
  if (existing.status !== "DRAFT")
    throw new BadRequestError("Only a DRAFT purchase order can be edited");
  assertBranchAccess(req, input.branchId ?? existing.branchId);

  let lines: { sparePartId: string; qtyOrdered: number; ratePaise: bigint; amountPaise: bigint }[] | undefined;
  let estimatedPaise: bigint | undefined;
  if (input.lines) {
    lines = input.lines.map((line) => ({
      ...line,
      amountPaise: line.ratePaise * BigInt(line.qtyOrdered),
    }));
    estimatedPaise = lines.reduce((sum, l) => sum + l.amountPaise, 0n);
  }

  await db.$transaction(
    async (tx) => {
      if (lines) await tx.purchaseOrderLine.deleteMany({ where: { poId: existing.id } });
      await tx.purchaseOrder.update({
        where: { id: existing.id },
        data: {
          ...(input.branchId ? { branchId: input.branchId } : {}),
          ...(input.supplierId ? { supplierId: input.supplierId } : {}),
          ...(input.poDate ? { poDate: input.poDate } : {}),
          ...(input.expectedDate !== undefined ? { expectedDate: input.expectedDate } : {}),
          ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
          ...(estimatedPaise !== undefined ? { estimatedPaise } : {}),
          updatedById: actorId(req),
          version: { increment: 1 },
          ...(lines
            ? {
              lines: {
                create: lines.map((line, index) => ({
                  lineNumber: index + 1,
                  sparePartId: line.sparePartId,
                  qtyOrdered: line.qtyOrdered,
                  ratePaise: line.ratePaise,
                  amountPaise: line.amountPaise,
                })),
              },
            }
            : {}),
        },
      });
    },
  );

  const updated = await db.purchaseOrder.findUnique({
    where: { id: existing.id },
    include: poDetailInclude,
  });
  sendOk(res, updated);
});

router.post("/:id/approve", can(PERMS.WORKSHOP.PO_APPROVE), async (req, res) => {
  const existing = await db.purchaseOrder.findUnique({
    where: { id: getParamId(req) },
    select: { id: true, status: true, branchId: true },
  });
  if (!existing) throw new NotFoundError("Purchase order not found");
  if (existing.status !== "DRAFT")
    throw new BadRequestError("Only a DRAFT purchase order can be approved");
  assertBranchAccess(req, existing.branchId);

  await db.purchaseOrder.update({
    where: { id: existing.id },
    data: { status: "APPROVED", approvedById: actorId(req), approvedAt: new Date() },
  });

  const updated = await db.purchaseOrder.findUnique({
    where: { id: existing.id },
    include: poDetailInclude,
  });
  sendOk(res, updated);
});

router.post("/:id/send", can(PERMS.WORKSHOP.PO_MANAGE), async (req, res) => {
  const existing = await db.purchaseOrder.findUnique({
    where: { id: getParamId(req) },
    select: { id: true, status: true, branchId: true },
  });
  if (!existing) throw new NotFoundError("Purchase order not found");
  if (existing.status !== "APPROVED")
    throw new BadRequestError("Only an APPROVED purchase order can be sent");
  assertBranchAccess(req, existing.branchId);

  await db.purchaseOrder.update({ where: { id: existing.id }, data: { status: "SENT" } });
  const updated = await db.purchaseOrder.findUnique({
    where: { id: existing.id },
    include: poDetailInclude,
  });
  sendOk(res, updated);
});

router.post("/:id/close", can(PERMS.WORKSHOP.PO_MANAGE), async (req, res) => {
  const existing = await db.purchaseOrder.findUnique({
    where: { id: getParamId(req) },
    select: { id: true, status: true, branchId: true },
  });
  if (!existing) throw new NotFoundError("Purchase order not found");
  if (!["PARTIALLY_RECEIVED", "RECEIVED", "SENT"].includes(existing.status))
    throw new BadRequestError("Purchase order cannot be closed from its current status");
  assertBranchAccess(req, existing.branchId);

  await db.purchaseOrder.update({ where: { id: existing.id }, data: { status: "CLOSED" } });
  const updated = await db.purchaseOrder.findUnique({
    where: { id: existing.id },
    include: poDetailInclude,
  });
  sendOk(res, updated);
});

router.post("/:id/cancel", can(PERMS.WORKSHOP.PO_MANAGE), async (req, res) => {
  const input = cancelPurchaseOrderSchema.parse(req.body);
  const existing = await db.purchaseOrder.findUnique({
    where: { id: getParamId(req) },
    select: { id: true, status: true, branchId: true },
  });
  if (!existing) throw new NotFoundError("Purchase order not found");
  if (["RECEIVED", "CLOSED", "CANCELLED"].includes(existing.status))
    throw new BadRequestError("This purchase order can no longer be cancelled");
  assertBranchAccess(req, existing.branchId);

  await db.purchaseOrder.update({
    where: { id: existing.id },
    data: {
      status: "CANCELLED",
      cancelledById: actorId(req),
      cancelledAt: new Date(),
      cancelReason: input.reason,
    },
  });

  const updated = await db.purchaseOrder.findUnique({
    where: { id: existing.id },
    include: poDetailInclude,
  });
  sendOk(res, updated);
});

export default router;
