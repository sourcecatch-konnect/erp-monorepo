import { Router } from "express";
import {
  createLRSchema,
  updateLRSchema,
  finaliseLRSchema,
  cancelLRSchema,
  addEwayBillSchema,
} from "@skerp/validators";
import { PERMS } from "@skerp/types";

import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { parseListQuery } from "../_shared/list.query.js";
import { sendOk } from "../_shared/response.js";
import { getParamId } from "../_shared/param.js";
import { fyCodeFor } from "../_shared/doc-number.js";
import { assertBranchAccess } from "../../auth/branch-scope.js";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../lib/error.js";
import type { LRStatus, LRSource } from "../../../generated/prisma/index.js";
import {
  generateLRNumber,
  assertTruckSlotAvailable,
  lrListSelect,
  lrDetailInclude,
} from "./lorry-receipt.service.js";

const router: Router = Router();
router.use(authMiddleware);

const actorId = (req: { user?: { userId: string } }) => req.user!.userId;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** LR list: user can view if they have origin OR destination branch. */
const lrBranchFilter = (req: Parameters<typeof assertBranchAccess>[0]) => {
  if (!req.ctx) return {};
  if (req.ctx.branchScope === "ALL") return {};
  if (req.ctx.branchIds.length === 0) {
    return { id: { in: [] } }; // impossible filter — sees nothing
  }
  return {
    OR: [
      { originBranchId: { in: req.ctx.branchIds } },
      { destinationBranchId: { in: req.ctx.branchIds } },
    ],
  };
};

/** Throw if the user's branches don't include the LR's origin branch. */
const assertOriginAccess = (
  req: Parameters<typeof assertBranchAccess>[0],
  originBranchId: string,
) => {
  assertBranchAccess(req, originBranchId);
};

/* ------------------------------------------------------------------ */
/* List                                                                */
/* ------------------------------------------------------------------ */
router.get("/", can(PERMS.LORRY_RECEIPT.VIEW), async (req, res) => {
  const query = parseListQuery(req);
  const where = {
    deletedAt: null,
    ...lrBranchFilter(req),
    ...(query.filter.status ? { status: query.filter.status as LRStatus } : {}),
    ...(query.filter.source ? { source: query.filter.source as LRSource } : {}),
    ...(query.filter.orderId ? { orderId: query.filter.orderId } : {}),
    ...(query.search
      ? { lrNumber: { contains: query.search, mode: "insensitive" as const } }
      : {}),
  };

  const [data, total] = await Promise.all([
    db.lorryReceipt.findMany({
      where,
      skip: query.page * query.size,
      take: query.size,
      select: lrListSelect,
      orderBy: query.sort
        ? { [query.sort.field]: query.sort.direction }
        : { createdAt: "desc" },
    }),
    db.lorryReceipt.count({ where }),
  ]);

  return sendOk(res, data, { page: query.page, size: query.size, total });
});

/* ------------------------------------------------------------------ */
/* Status counts                                                       */
/* ------------------------------------------------------------------ */
router.get(
  "/status-counts",
  can(PERMS.LORRY_RECEIPT.VIEW),
  async (req, res) => {
    const where = { deletedAt: null, ...lrBranchFilter(req) };
    const grouped = await db.lorryReceipt.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    });
    const counts: Record<string, number> = {};
    let all = 0;
    for (const g of grouped) {
      counts[g.status] = g._count._all;
      all += g._count._all;
    }
    counts.ALL = all;
    return sendOk(res, counts);
  },
);

/* ------------------------------------------------------------------ */
/* Detail                                                              */
/* ------------------------------------------------------------------ */
router.get("/:id", can(PERMS.LORRY_RECEIPT.VIEW), async (req, res) => {
  const id = getParamId(req);
  const lr = await db.lorryReceipt.findFirst({
    where: { id, deletedAt: null, ...lrBranchFilter(req) },
    include: lrDetailInclude,
  });
  if (!lr) throw new NotFoundError("Lorry receipt not found");
  return sendOk(res, lr);
});

/* ------------------------------------------------------------------ */
/* Create draft                                                        */
/* ------------------------------------------------------------------ */
router.post("/", can(PERMS.LORRY_RECEIPT.CREATE), async (req, res) => {
  const parsed = createLRSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const input = parsed.data;
  const me = actorId(req);

  const lr = await db.$transaction(async (tx) => {
    let originBranchId: string;
    let destinationBranchId: string;
    let consignorId: string;

    if (input.source === "FROM_ORDER") {
      const order = await tx.order.findUnique({
        where: { id: input.orderId },
        select: {
          id: true,
          customerId: true,
          fromBranchId: true,
          toBranchId: true,
          orderType: true,
          truckQuantity: true,
          status: true,
        },
      });
      if (!order) throw new BadRequestError("Order not found");
      if (order.status !== "Confirmed") {
        throw new BadRequestError("LR can only be created for a Confirmed order");
      }
      if (order.orderType !== "Truck") {
        throw new BadRequestError(
          "Item orders are not supported for LR creation in this release",
        );
      }
      if (!order.truckQuantity) {
        throw new BadRequestError("Order has no truck quantity set");
      }

      await assertTruckSlotAvailable(tx, order.id, order.truckQuantity);

      originBranchId = order.fromBranchId;
      destinationBranchId = order.toBranchId;
      consignorId = order.customerId;
    } else {
      originBranchId = input.originBranchId;
      destinationBranchId = input.destinationBranchId;
      consignorId = input.consignorId;
    }

    // Origin-branch access check
    assertOriginAccess(req, originBranchId);

    const originBranch = await tx.branch.findUnique({
      where: { id: originBranchId },
      select: { branchCode: true },
    });
    if (!originBranch) throw new BadRequestError("Origin branch not found");

    const now = new Date();
    const fyCode = fyCodeFor(now);
    const lrNumber = await generateLRNumber(tx, originBranch.branchCode, fyCode);

    const consigneeId =
      input.source === "FROM_ORDER" ? input.consigneeId : input.consigneeId;

    const isMarketVehicle = input.isMarketVehicle ?? false;

    const created = await tx.lorryReceipt.create({
      data: {
        lrNumber,
        fyCode,
        source: input.source,
        orderId: input.source === "FROM_ORDER" ? input.orderId : null,
        originBranchId,
        destinationBranchId,
        // Transport
        transportType: input.source === "INSTANT" ? "Road" : (input.transportType ?? "Road"),
        tripLegType: input.source === "INSTANT" ? "DIRECT" : (input.tripLegType ?? "DIRECT"),
        hubId: input.source === "FROM_ORDER" ? (input.hubId ?? null) : null,
        // Vehicle
        isMarketVehicle,
        primaryTripId: !isMarketVehicle ? (input.primaryTripId ?? null) : null,
        secondaryTripId: !isMarketVehicle ? (input.secondaryTripId ?? null) : null,
        marketVehicleNumber: isMarketVehicle ? (input.marketVehicleNumber ?? null) : null,
        marketDriverName: isMarketVehicle ? (input.marketDriverName ?? null) : null,
        // Parties
        consignorId,
        consigneeId,
        // Meta (invoice captured at finalisation)
        priority: input.priority ?? "Normal",
        status: "DRAFT",
        createdById: me,
        goods: {
          create: input.goods.map((g) => ({
            name: g.name,
            description: g.description ?? null,
            quantity: g.quantity,
            unit: g.unit,
            weight: g.weight ?? null,
            length: g.length ?? null,
            width: g.width ?? null,
            height: g.height ?? null,
          })),
        },
      },
      include: lrDetailInclude,
    });

    return created;
  });

  return sendOk(res, lr, undefined, 201);
});

/* ------------------------------------------------------------------ */
/* Update draft                                                        */
/* ------------------------------------------------------------------ */
router.patch("/:id", can(PERMS.LORRY_RECEIPT.UPDATE), async (req, res) => {
  const id = getParamId(req);
  const existing = await db.lorryReceipt.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw new NotFoundError("Lorry receipt not found");
  if (existing.status !== "DRAFT") {
    throw new BadRequestError("Only a DRAFT lorry receipt can be edited");
  }

  assertOriginAccess(req, existing.originBranchId);

  const parsed = updateLRSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const input = parsed.data;
  const me = actorId(req);

  const updated = await db.$transaction(async (tx) => {
    if (input.goods) {
      // Replace goods lines atomically
      await tx.lRGoods.deleteMany({ where: { lorryReceiptId: id } });
    }

    return tx.lorryReceipt.update({
      where: { id },
      data: {
        ...(input.isMarketVehicle !== undefined ? { isMarketVehicle: input.isMarketVehicle } : {}),
        ...(input.primaryTripId !== undefined ? { primaryTripId: input.primaryTripId ?? null } : {}),
        ...(input.secondaryTripId !== undefined ? { secondaryTripId: input.secondaryTripId ?? null } : {}),
        ...(input.marketVehicleNumber !== undefined ? { marketVehicleNumber: input.marketVehicleNumber ?? null } : {}),
        ...(input.marketDriverName !== undefined ? { marketDriverName: input.marketDriverName ?? null } : {}),
        ...(input.transportType ? { transportType: input.transportType } : {}),
        ...(input.tripLegType ? { tripLegType: input.tripLegType } : {}),
        ...(input.hubId !== undefined ? { hubId: input.hubId ?? null } : {}),
        ...(input.consigneeId ? { consigneeId: input.consigneeId } : {}),
        ...(input.priority ? { priority: input.priority } : {}),
        ...(input.invoiceNumber !== undefined ? { invoiceNumber: input.invoiceNumber ?? null } : {}),
        ...(input.invoiceAmount !== undefined ? { invoiceAmount: input.invoiceAmount ?? null } : {}),
        ...(input.goods
          ? {
              goods: {
                create: input.goods.map((g) => ({
                  name: g.name,
                  description: g.description ?? null,
                  quantity: g.quantity,
                  unit: g.unit,
                  weight: g.weight ?? null,
                  length: g.length ?? null,
                  width: g.width ?? null,
                  height: g.height ?? null,
                })),
              },
            }
          : {}),
        updatedById: me,
        version: { increment: 1 },
      },
      include: lrDetailInclude,
    });
  });

  return sendOk(res, updated);
});

/* ------------------------------------------------------------------ */
/* Finalise -> FINALISED                                               */
/* ------------------------------------------------------------------ */
router.post(
  "/:id/finalise",
  can(PERMS.LORRY_RECEIPT.APPROVE),
  async (req, res) => {
    const id = getParamId(req);
    const existing = await db.lorryReceipt.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundError("Lorry receipt not found");
    if (existing.status !== "DRAFT") {
      throw new BadRequestError("Only a DRAFT lorry receipt can be finalised");
    }

    assertOriginAccess(req, existing.originBranchId);

    const parsed = finaliseLRSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }
    const { sealNumber, invoiceNumber, invoiceAmount, baseFreightAmount, ewayBill } =
      parsed.data;
    const me = actorId(req);

    const updated = await db.$transaction(async (tx) => {
      await tx.lRCharge.create({
        data: {
          lorryReceiptId: id,
          chargeType: "BASE_FREIGHT",
          amount: baseFreightAmount,
        },
      });

      await tx.ewayBill.create({
        data: {
          lorryReceiptId: id,
          ewayBillNo: ewayBill.ewayBillNo,
          generatedAt: ewayBill.generatedAt,
          expiresAt: ewayBill.expiresAt,
          generatedBy: ewayBill.generatedBy ?? null,
          documentUrl: ewayBill.documentUrl ?? null,
        },
      });

      return tx.lorryReceipt.update({
        where: { id },
        data: {
          status: "FINALISED",
          sealNumber: sealNumber ?? null,
          invoiceNumber: invoiceNumber ?? null,
          invoiceAmount: invoiceAmount ?? null,
          finalisedAt: new Date(),
          finalisedById: me,
          updatedById: me,
          version: { increment: 1 },
        },
        include: lrDetailInclude,
      });
    });

    return sendOk(res, updated);
  },
);

/* ------------------------------------------------------------------ */
/* Cancel -> CANCELLED                                                 */
/* ------------------------------------------------------------------ */
router.post(
  "/:id/cancel",
  can(PERMS.LORRY_RECEIPT.CANCEL),
  async (req, res) => {
    const id = getParamId(req);
    const existing = await db.lorryReceipt.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundError("Lorry receipt not found");
    if (existing.status === "CANCELLED") {
      throw new BadRequestError("Lorry receipt is already cancelled");
    }
    if (existing.status === "FINALISED") {
      throw new BadRequestError("A finalised lorry receipt cannot be cancelled");
    }

    assertOriginAccess(req, existing.originBranchId);

    const parsed = cancelLRSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }
    const me = actorId(req);

    const updated = await db.lorryReceipt.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelReason: parsed.data.cancelReason,
        updatedById: me,
        version: { increment: 1 },
      },
      include: lrDetailInclude,
    });

    return sendOk(res, updated);
  },
);

/* ------------------------------------------------------------------ */
/* Add e-way bill (additional, post-finalise)                          */
/* ------------------------------------------------------------------ */
router.post(
  "/:id/eway-bills",
  can(PERMS.LORRY_RECEIPT.UPDATE),
  async (req, res) => {
    const id = getParamId(req);
    const existing = await db.lorryReceipt.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundError("Lorry receipt not found");
    if (existing.status === "CANCELLED") {
      throw new BadRequestError("Cannot add e-way bill to a cancelled LR");
    }

    assertOriginAccess(req, existing.originBranchId);

    const parsed = addEwayBillSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }
    const input = parsed.data;

    const ewayBill = await db.ewayBill.create({
      data: {
        lorryReceiptId: id,
        ewayBillNo: input.ewayBillNo,
        generatedAt: input.generatedAt,
        expiresAt: input.expiresAt,
        generatedBy: input.generatedBy ?? null,
        documentUrl: input.documentUrl ?? null,
      },
    });

    return sendOk(res, ewayBill, undefined, 201);
  },
);

export default router;
