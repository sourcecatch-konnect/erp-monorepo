import { Router } from "express";
import {
  createLRGroupSchema,
  updateLRGroupSchema,
  finaliseGroupSchema,
  splitGroupAtHubSchema,
  cancelGroupSchema,
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
  NotFoundError,
  ValidationError,
} from "../../lib/error.js";
import { Prisma } from "../../../generated/prisma/index.js";
import type { LRGroupStatus } from "../../../generated/prisma/index.js";
import {
  generateLRNumber,
  resolveHubBranchId,
} from "../lorry-receipt/lorry-receipt.service.js";
import {
  generateGroupNumber,
  assertGroupSlotAvailable,
  dispatchTripOnAttach,
  groupListSelect,
  groupDetailInclude,
} from "./lr-group.service.js";

const router: Router = Router();
router.use(authMiddleware);

const actorId = (req: { user?: { userId: string } }) => req.user!.userId;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Group list: user can view if they have origin OR destination branch. */
const groupBranchFilter = (req: Parameters<typeof assertBranchAccess>[0]) => {
  if (!req.ctx) return {};
  if (req.ctx.branchScope === "ALL") return {};
  if (req.ctx.branchIds.length === 0) {
    return { id: { in: [] as string[] } }; // impossible filter — sees nothing
  }
  return {
    OR: [
      { originBranchId: { in: req.ctx.branchIds } },
      { destinationBranchId: { in: req.ctx.branchIds } },
    ],
  };
};

/** A goods line as stored on an LR (denormalised name + dimensions). */
type LRGoodsCreate = {
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
};

/* ------------------------------------------------------------------ */
/* List                                                                */
/* ------------------------------------------------------------------ */
router.get("/", can(PERMS.LORRY_RECEIPT.VIEW), async (req, res) => {
  const query = parseListQuery(req);
  const where = {
    deletedAt: null,
    ...groupBranchFilter(req),
    ...(query.filter.status
      ? { status: query.filter.status as LRGroupStatus }
      : {}),
    ...(query.filter.orderId ? { orderId: query.filter.orderId } : {}),
    ...(query.search
      ? { groupNumber: { contains: query.search, mode: "insensitive" as const } }
      : {}),
  };

  const [data, total] = await Promise.all([
    db.lRGroup.findMany({
      where,
      skip: query.page * query.size,
      take: query.size,
      select: groupListSelect,
      orderBy: query.sort
        ? { [query.sort.field]: query.sort.direction }
        : { createdAt: "desc" },
    }),
    db.lRGroup.count({ where }),
  ]);

  return sendOk(res, data, { page: query.page, size: query.size, total });
});

/* ------------------------------------------------------------------ */
/* Status counts                                                       */
/* ------------------------------------------------------------------ */
router.get("/status-counts", can(PERMS.LORRY_RECEIPT.VIEW), async (req, res) => {
  const where = { deletedAt: null, ...groupBranchFilter(req) };
  const grouped = await db.lRGroup.groupBy({
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
});

/* ------------------------------------------------------------------ */
/* Detail                                                              */
/* ------------------------------------------------------------------ */
router.get("/:id", can(PERMS.LORRY_RECEIPT.VIEW), async (req, res) => {
  const id = getParamId(req);
  const group = await db.lRGroup.findFirst({
    where: { id, deletedAt: null, ...groupBranchFilter(req) },
    include: groupDetailInclude,
  });
  if (!group) throw new NotFoundError("Lorry receipt group not found");
  return sendOk(res, group);
});

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */
router.post("/", can(PERMS.LORRY_RECEIPT.CREATE), async (req, res) => {
  const parsed = createLRGroupSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const input = parsed.data;
  const me = actorId(req);

  const group = await db.$transaction(async (tx) => {
    let originBranchId: string;
    let destinationBranchId: string;
    let consignorId: string;
    let consigneeId: string;
    let orderId: string | null = null;
    let truckIndex = 1;
    // Each LR is one consignment: its loading/unloading location + goods lines.
    let lines: {
      loadingLocationId: string | null;
      unloadingLocationId: string | null;
      goods: LRGoodsCreate[];
    }[];

    if (input.source === "FROM_ORDER") {
      const order = await tx.order.findUnique({
        where: { id: input.orderId },
        select: {
          id: true,
          customerId: true,
          consigneeId: true,
          fromBranchId: true,
          toBranchId: true,
          orderType: true,
          truckQuantity: true,
          status: true,
        },
      });
      if (!order) throw new BadRequestError("Order not found");
      if (order.status !== "Confirmed") {
        throw new BadRequestError("A group can only be created for a Confirmed order");
      }
      if (order.orderType !== "Truck") {
        throw new BadRequestError("Only Truck orders support group creation");
      }
      if (!order.truckQuantity) {
        throw new BadRequestError("Order has no truck quantity set");
      }
      if (!order.consigneeId) {
        throw new BadRequestError("Set the order's consignee before creating a group");
      }

      truckIndex = input.truckIndex ?? 1;
      await assertGroupSlotAvailable(tx, order.id, order.truckQuantity, truckIndex);

      const consignments = await tx.orderConsignment.findMany({
        where: { orderId: order.id, truckIndex },
        include: { goods: { include: { goods: { select: { name: true } } } } },
      });
      if (consignments.length === 0) {
        throw new BadRequestError(
          `Order has no consignment lines for truck #${truckIndex}`,
        );
      }

      originBranchId = order.fromBranchId;
      destinationBranchId = order.toBranchId;
      consignorId = order.customerId;
      consigneeId = order.consigneeId;
      orderId = order.id;
      lines = consignments.map((c) => ({
        loadingLocationId: c.loadingLocationId,
        unloadingLocationId: c.unloadingLocationId,
        goods: c.goods.map((g) => ({
          name: g.goods.name,
          description: null,
          quantity: g.quantity,
          unit: g.unit,
          weight: g.weight ? Number(g.weight) : null,
          length: null,
          width: null,
          height: null,
        })),
      }));
    } else {
      originBranchId = input.originBranchId;
      destinationBranchId = input.destinationBranchId;
      consignorId = input.consignorId;
      consigneeId = input.consigneeId;
      lines = input.lrs.map((l) => ({
        loadingLocationId: l.loadingLocationId ?? null,
        unloadingLocationId: l.unloadingLocationId ?? null,
        goods: l.goods.map((g) => ({
          name: g.name,
          description: g.description ?? null,
          quantity: g.quantity,
          unit: g.unit,
          weight: g.weight ?? null,
          length: g.length ?? null,
          width: g.width ?? null,
          height: g.height ?? null,
        })),
      }));
    }

    // Origin-branch access check.
    assertBranchAccess(req, originBranchId);

    const originBranch = await tx.branch.findUnique({
      where: { id: originBranchId },
      select: { branchCode: true },
    });
    if (!originBranch) throw new BadRequestError("Origin branch not found");

    const now = new Date();
    const fyCode = fyCodeFor(now);
    const groupNumber = await generateGroupNumber(tx, originBranch.branchCode, fyCode);

    const isMarketVehicle = input.isMarketVehicle ?? false;
    const transportType =
      input.source === "INSTANT" ? "Road" : (input.transportType ?? "Road");
    const tripLegType =
      input.source === "FROM_ORDER" ? (input.tripLegType ?? "DIRECT") : "DIRECT";
    const hubId = tripLegType === "DIRECT" ? null : await resolveHubBranchId(tx);
    const railheadBranchId =
      input.source === "FROM_ORDER" ? (input.railheadBranchId ?? null) : null;
    const primaryTripId = !isMarketVehicle ? (input.primaryTripId ?? null) : null;

    // Generate an LR number per line up front (one consignment = one LR).
    const lrNumbers: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      lrNumbers.push(await generateLRNumber(tx, originBranch.branchCode, fyCode));
    }

    const created = await tx.lRGroup.create({
      data: {
        groupNumber,
        fyCode,
        source: input.source,
        orderId,
        truckIndex,
        originBranchId,
        destinationBranchId,
        consignorId,
        consigneeId,
        transportType,
        priority: input.priority ?? "Normal",
        tripLegType,
        hubId,
        railheadBranchId,
        isMarketVehicle,
        primaryTripId,
        marketVehicleNumber: isMarketVehicle ? (input.marketVehicleNumber ?? null) : null,
        marketDriverName: isMarketVehicle ? (input.marketDriverName ?? null) : null,
        status: "DRAFT",
        createdById: me,
        lorryReceipts: {
          create: lines.map((line, i) => ({
            lrNumber: lrNumbers[i]!,
            fyCode,
            loadingLocationId: line.loadingLocationId,
            unloadingLocationId: line.unloadingLocationId,
            status: "DRAFT",
            createdById: me,
            goods: { create: line.goods },
          })),
        },
      },
      include: groupDetailInclude,
    });

    // Own-vehicle group attached to a Planned trip dispatches it (-> InTransit).
    if (primaryTripId) {
      await dispatchTripOnAttach(tx, primaryTripId, created.groupNumber, me);
    }

    return created;
  });

  return sendOk(res, group, undefined, 201);
});

/* ------------------------------------------------------------------ */
/* Update draft                                                        */
/* ------------------------------------------------------------------ */
router.patch("/:id", can(PERMS.LORRY_RECEIPT.UPDATE), async (req, res) => {
  const id = getParamId(req);
  const existing = await db.lRGroup.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new NotFoundError("Lorry receipt group not found");
  if (existing.status !== "DRAFT") {
    throw new BadRequestError("Only a DRAFT group can be edited");
  }
  assertBranchAccess(req, existing.originBranchId);

  const parsed = updateLRGroupSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const input = parsed.data;
  const me = actorId(req);

  const updated = await db.lRGroup.update({
    where: { id },
    data: {
      ...(input.consigneeId !== undefined ? { consigneeId: input.consigneeId } : {}),
      ...(input.transportType ? { transportType: input.transportType } : {}),
      ...(input.railheadBranchId !== undefined
        ? { railheadBranchId: input.railheadBranchId ?? null }
        : {}),
      ...(input.priority ? { priority: input.priority } : {}),
      ...(input.isMarketVehicle !== undefined
        ? { isMarketVehicle: input.isMarketVehicle }
        : {}),
      ...(input.primaryTripId !== undefined
        ? { primaryTripId: input.primaryTripId ?? null }
        : {}),
      ...(input.marketVehicleNumber !== undefined
        ? { marketVehicleNumber: input.marketVehicleNumber ?? null }
        : {}),
      ...(input.marketDriverName !== undefined
        ? { marketDriverName: input.marketDriverName ?? null }
        : {}),
      updatedById: me,
      version: { increment: 1 },
    },
    include: groupDetailInclude,
  });

  return sendOk(res, updated);
});

/* ------------------------------------------------------------------ */
/* Finalise — atomic over the whole group                              */
/* ------------------------------------------------------------------ */
router.post("/:id/finalise", can(PERMS.LORRY_RECEIPT.APPROVE), async (req, res) => {
  const id = getParamId(req);
  const existing = await db.lRGroup.findFirst({
    where: { id, deletedAt: null },
    include: {
      lorryReceipts: { where: { deletedAt: null }, select: { id: true, status: true } },
    },
  });
  if (!existing) throw new NotFoundError("Lorry receipt group not found");
  if (existing.status !== "DRAFT") {
    throw new BadRequestError("Only a DRAFT group can be finalised");
  }
  assertBranchAccess(req, existing.originBranchId);

  const parsed = finaliseGroupSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const { baseFreightAmount, sealNumber, lrs } = parsed.data;
  const me = actorId(req);

  // All-or-nothing: the payload must cover exactly the group's LRs.
  const groupLrIds = new Set(existing.lorryReceipts.map((l) => l.id));
  const payloadLrIds = new Set(lrs.map((l) => l.lrId));
  if (
    groupLrIds.size !== payloadLrIds.size ||
    [...groupLrIds].some((lid) => !payloadLrIds.has(lid))
  ) {
    throw new BadRequestError(
      "Finalise must cover every lorry receipt in the group exactly once",
    );
  }

  const updated = await db.$transaction(async (tx) => {
    for (const line of lrs) {
      await tx.ewayBill.create({
        data: {
          lorryReceiptId: line.lrId,
          ewayBillNo: line.ewayBill.ewayBillNo,
          generatedAt: line.ewayBill.generatedAt,
          expiresAt: line.ewayBill.expiresAt,
          generatedBy: line.ewayBill.generatedBy ?? null,
          documentUrl: line.ewayBill.documentUrl ?? null,
        },
      });
      await tx.lorryReceipt.update({
        where: { id: line.lrId },
        data: {
          status: "FINALISED",
          invoiceNumber: line.invoiceNumber ?? null,
          invoiceAmount: line.invoiceAmount ?? null,
          updatedById: me,
          version: { increment: 1 },
        },
      });
    }

    return tx.lRGroup.update({
      where: { id },
      data: {
        status: "FINALISED",
        baseFreightAmount,
        sealNumber: sealNumber ?? null,
        finalisedAt: new Date(),
        finalisedById: me,
        updatedById: me,
        version: { increment: 1 },
      },
      include: groupDetailInclude,
    });
  });

  return sendOk(res, updated);
});

/* ------------------------------------------------------------------ */
/* Split at hub (HO action) — attach leg-2 trip to a FINALISED group    */
/* ------------------------------------------------------------------ */
router.post("/:id/split-at-hub", can(PERMS.LORRY_RECEIPT.APPROVE), async (req, res) => {
  const id = getParamId(req);
  const existing = await db.lRGroup.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new NotFoundError("Lorry receipt group not found");
  if (existing.status !== "FINALISED") {
    throw new BadRequestError("Hub split is only allowed on a finalised group");
  }

  const parsed = splitGroupAtHubSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const { secondaryTripId } = parsed.data;
  const me = actorId(req);

  const updated = await db.$transaction(async (tx) => {
    const hubId = await resolveHubBranchId(tx);

    // Leg 1 must have completed before the hub -> destination leg picks up.
    if (existing.primaryTripId) {
      const leg1 = await tx.vehicleTrip.findUnique({
        where: { id: existing.primaryTripId },
        select: { status: true },
      });
      if (leg1 && leg1.status !== "Closed") {
        throw new BadRequestError(
          "The leg 1 trip must be Closed before attaching a leg 2 trip",
        );
      }
    }

    const leg2 = await tx.vehicleTrip.findUnique({
      where: { id: secondaryTripId },
      select: { id: true, status: true },
    });
    if (!leg2) throw new BadRequestError("Leg 2 trip not found");
    if (secondaryTripId === existing.primaryTripId) {
      throw new BadRequestError("Leg 2 trip must differ from the leg 1 trip");
    }
    if (leg2.status !== "Planned") {
      throw new BadRequestError("Leg 2 trip must be a Planned trip");
    }

    const result = await tx.lRGroup.update({
      where: { id },
      data: {
        hubId,
        secondaryTripId,
        tripLegType: "FROM_HUB",
        updatedById: me,
        version: { increment: 1 },
      },
      include: groupDetailInclude,
    });

    await dispatchTripOnAttach(tx, secondaryTripId, existing.groupNumber, me);

    return result;
  });

  return sendOk(res, updated);
});

/* ------------------------------------------------------------------ */
/* Cancel — cancels the group and all its LRs                          */
/* ------------------------------------------------------------------ */
router.post("/:id/cancel", can(PERMS.LORRY_RECEIPT.CANCEL), async (req, res) => {
  const id = getParamId(req);
  const existing = await db.lRGroup.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new NotFoundError("Lorry receipt group not found");
  if (existing.status === "CANCELLED") {
    throw new BadRequestError("Group is already cancelled");
  }
  if (existing.status === "FINALISED") {
    throw new BadRequestError("A finalised group cannot be cancelled");
  }
  assertBranchAccess(req, existing.originBranchId);

  const parsed = cancelGroupSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const me = actorId(req);

  const updated = await db.$transaction(async (tx) => {
    await tx.lorryReceipt.updateMany({
      where: { groupId: id, status: { not: "CANCELLED" } },
      data: { status: "CANCELLED", cancelReason: parsed.data.cancelReason, updatedById: me },
    });
    return tx.lRGroup.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelReason: parsed.data.cancelReason,
        updatedById: me,
        version: { increment: 1 },
      },
      include: groupDetailInclude,
    });
  });

  return sendOk(res, updated);
});

export default router;
