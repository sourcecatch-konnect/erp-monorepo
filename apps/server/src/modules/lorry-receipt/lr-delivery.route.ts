import { Router } from "express";
import {
  deliverLRSchema,
  updateLRDeliverySchema,
  acknowledgeLRSchema,
  updateLRAcknowledgementSchema,
} from "@skerp/validators";
import { PERMS } from "@skerp/types";

import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { sendOk } from "../_shared/response.js";
import { getParamId } from "../_shared/param.js";
import { assertBranchAccess } from "../../auth/branch-scope.js";
import {
  BadRequestError,
  NotFoundError,
  ValidationError,
} from "../../lib/error.js";
import {
  deliveryInclude,
  ackInclude,
  assertFinalTripNotClosed,
  publishLRDelivered,
  syncGroupDeliveryStatus,
} from "./lr-delivery.service.js";

/**
 * Delivery + acknowledgement actions on a single LR. Mounted on
 * /lorry-receipts BEFORE the main LR router (its GET /:id would otherwise
 * swallow the worklist paths added later).
 *
 * Branch model (see docs/LR_DELIVERY_ACK_PLAN.md §3): delivery happens at the
 * group's DESTINATION branch; the POD paper couriers back to the ORIGIN
 * (booking) branch, which records the acknowledgement.
 */
const router: Router = Router();
router.use(authMiddleware);

const actorId = (req: { user?: { userId: string } }) => req.user!.userId;

const lrForAction = async (id: string) => {
  const lr = await db.lorryReceipt.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      lrNumber: true,
      status: true,
      createdById: true,
      goods: { select: { id: true } },
      delivery: { select: { id: true } },
      acknowledgement: { select: { id: true } },
      group: {
        select: {
          id: true,
          groupNumber: true,
          originBranchId: true,
          destinationBranchId: true,
          primaryTripId: true,
          secondaryTripId: true,
        },
      },
    },
  });
  if (!lr) throw new NotFoundError("Lorry receipt not found");
  return lr;
};

/** Origin-or-destination branch scope for worklist queries. */
type LRScopeWhere = {
  id?: { in: string[] };
  group?: { OR: Record<string, unknown>[] };
};
const lrBranchFilter = (
  req: Parameters<typeof assertBranchAccess>[0],
): LRScopeWhere => {
  if (!req.ctx) return {};
  if (req.ctx.branchScope === "ALL") return {};
  if (req.ctx.branchIds.length === 0) {
    return { id: { in: [] as string[] } };
  }
  return {
    group: {
      OR: [
        { originBranchId: { in: req.ctx.branchIds } },
        { destinationBranchId: { in: req.ctx.branchIds } },
      ],
    },
  };
};

const worklistGroupSelect = {
  id: true,
  groupNumber: true,
  finalisedAt: true,
  isMarketVehicle: true,
  marketVehicleNumber: true,
  consignee: { select: { id: true, name: true, shortName: true } },
  originBranch: { select: { id: true, name: true, branchCode: true } },
  destinationBranch: { select: { id: true, name: true, branchCode: true } },
  primaryTrip: {
    select: { id: true, vehicle: { select: { vehicleNumber: true } } },
  },
  secondaryTrip: {
    select: { id: true, vehicle: { select: { vehicleNumber: true } } },
  },
};

/* ------------------------------------------------------------------ */
/* Worklists (docs/LR_DELIVERY_ACK_PLAN.md §8)                          */
/* ------------------------------------------------------------------ */

/**
 * FINALISED LRs on dispatched groups — fleet AND market — oldest first.
 * Groups lying at the hub are excluded; they have their own worklist.
 */
router.get(
  "/worklists/pending-delivery",
  can(PERMS.LORRY_RECEIPT.VIEW),
  async (req, res) => {
    const scope = lrBranchFilter(req);
    const data = await db.lorryReceipt.findMany({
      where: {
        deletedAt: null,
        status: "FINALISED",
        ...(scope.id ? { id: scope.id } : {}),
        group: {
          ...(scope.group ?? {}),
          status: "FINALISED",
          deletedAt: null,
          NOT: { hubId: { not: null }, secondaryTripId: null },
        },
      },
      select: {
        id: true,
        lrNumber: true,
        status: true,
        unloadingLocation: { select: { id: true, name: true } },
        group: { select: worklistGroupSelect },
      },
      orderBy: { group: { finalisedAt: "asc" } },
      take: 500,
    });
    return sendOk(res, data);
  },
);

/** DELIVERED-but-not-ACKNOWLEDGED LRs — POD paper still in the field. */
router.get(
  "/worklists/pending-pod",
  can(PERMS.LORRY_RECEIPT.VIEW),
  async (req, res) => {
    const data = await db.lorryReceipt.findMany({
      where: {
        deletedAt: null,
        status: "DELIVERED",
        ...lrBranchFilter(req),
      },
      select: {
        id: true,
        lrNumber: true,
        status: true,
        delivery: { select: { deliveredAt: true, receiverName: true } },
        group: { select: worklistGroupSelect },
      },
      orderBy: { delivery: { deliveredAt: "asc" } },
      take: 500,
    });
    return sendOk(res, data);
  },
);

/** Counts + average delivery days for the dashboard cards. */
router.get(
  "/worklists/delivery-stats",
  can(PERMS.LORRY_RECEIPT.VIEW),
  async (req, res) => {
    const scope = lrBranchFilter(req);
    const lrScope = {
      ...(scope.id ? { id: scope.id } : {}),
      ...(scope.group ? { group: scope.group } : {}),
    };

    const [pendingDelivery, atHub, pendingPod, recentDeliveries] =
      await Promise.all([
        db.lorryReceipt.count({
          where: {
            deletedAt: null,
            status: "FINALISED",
            ...(scope.id ? { id: scope.id } : {}),
            group: {
              ...(scope.group ?? {}),
              status: "FINALISED",
              deletedAt: null,
              NOT: { hubId: { not: null }, secondaryTripId: null },
            },
          },
        }),
        db.lRGroup.count({
          where: {
            deletedAt: null,
            status: "FINALISED",
            hubId: { not: null },
            secondaryTripId: null,
            ...(scope.group ?? {}),
          },
        }),
        db.lorryReceipt.count({
          where: { deletedAt: null, status: "DELIVERED", ...lrScope },
        }),
        db.lRDelivery.findMany({
          where: {
            deliveredAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
            lr: { deletedAt: null, ...lrScope },
          },
          select: {
            deliveredAt: true,
            lr: { select: { group: { select: { finalisedAt: true } } } },
          },
          take: 1000,
        }),
      ]);

    const spans = recentDeliveries
      .map((d) =>
        d.lr.group.finalisedAt
          ? (d.deliveredAt.getTime() - d.lr.group.finalisedAt.getTime()) /
            86_400_000
          : null,
      )
      .filter((v): v is number => v != null && v >= 0);
    const avgDeliveryDays = spans.length
      ? Math.round((spans.reduce((a, b) => a + b, 0) / spans.length) * 10) / 10
      : null;

    return sendOk(res, { pendingDelivery, atHub, pendingPod, avgDeliveryDays });
  },
);

/* ------------------------------------------------------------------ */
/* Mark delivered                                                      */
/* ------------------------------------------------------------------ */
router.post(
  "/:id/deliver",
  can(PERMS.LORRY_RECEIPT.DELIVER),
  async (req, res) => {
    const id = getParamId(req);
    const lr = await lrForAction(id);

    if (lr.status !== "FINALISED") {
      throw new BadRequestError(
        "Only a FINALISED lorry receipt can be marked delivered",
      );
    }
    assertBranchAccess(req, lr.group.destinationBranchId);

    const parsed = deliverLRSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }
    const input = parsed.data;
    const me = actorId(req);

    await db.$transaction(async (tx) => {
      await tx.lRDelivery.create({
        data: {
          lrId: id,
          deliveredAt: input.deliveredAt,
          reportedAt: input.reportedAt ?? null,
          receiverName: input.receiverName ?? null,
          receiverPhone: input.receiverPhone ?? null,
          unloadingCharges: input.unloadingCharges ?? null,
          remark: input.remark ?? null,
          createdById: me,
        },
        select: { id: true },
      });
      await tx.lorryReceipt.update({
        where: { id },
        data: {
          status: "DELIVERED",
          updatedById: me,
          version: { increment: 1 },
        },
        select: { id: true },
      });
      await syncGroupDeliveryStatus(tx, lr.group.id, me);
    });

    await publishLRDelivered(lr, me);

    const delivery = await db.lRDelivery.findUniqueOrThrow({
      where: { lrId: id },
      include: deliveryInclude,
    });
    return sendOk(res, delivery, undefined, 201);
  },
);

/* ------------------------------------------------------------------ */
/* Edit delivery details (never touches status)                        */
/* ------------------------------------------------------------------ */
router.patch(
  "/:id/delivery",
  can(PERMS.LORRY_RECEIPT.DELIVER),
  async (req, res) => {
    const id = getParamId(req);
    const lr = await lrForAction(id);
    if (!lr.delivery) {
      throw new BadRequestError("This lorry receipt has no delivery record");
    }
    assertBranchAccess(req, lr.group.destinationBranchId);

    const parsed = updateLRDeliverySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }
    const input = parsed.data;
    if (
      input.reportedAt &&
      input.deliveredAt &&
      input.reportedAt > input.deliveredAt
    ) {
      throw new BadRequestError(
        "Reporting time cannot be after the delivery time",
      );
    }
    const me = actorId(req);

    const updated = await db.lRDelivery.update({
      where: { lrId: id },
      data: {
        ...(input.deliveredAt !== undefined
          ? { deliveredAt: input.deliveredAt }
          : {}),
        ...(input.reportedAt !== undefined
          ? { reportedAt: input.reportedAt ?? null }
          : {}),
        ...(input.receiverName !== undefined
          ? { receiverName: input.receiverName ?? null }
          : {}),
        ...(input.receiverPhone !== undefined
          ? { receiverPhone: input.receiverPhone ?? null }
          : {}),
        ...(input.unloadingCharges !== undefined
          ? { unloadingCharges: input.unloadingCharges ?? null }
          : {}),
        ...(input.remark !== undefined ? { remark: input.remark ?? null } : {}),
        updatedById: me,
        version: { increment: 1 },
      },
      include: deliveryInclude,
    });

    return sendOk(res, updated);
  },
);

/* ------------------------------------------------------------------ */
/* Undo delivery — gated by the final trip's status                    */
/* ------------------------------------------------------------------ */
router.post(
  "/:id/undo-delivery",
  can(PERMS.LORRY_RECEIPT.DELIVER),
  async (req, res) => {
    const id = getParamId(req);
    const lr = await lrForAction(id);

    if (lr.status !== "DELIVERED") {
      if (lr.status === "ACKNOWLEDGED") {
        throw new BadRequestError(
          "Undo the acknowledgement before undoing the delivery",
        );
      }
      throw new BadRequestError("This lorry receipt is not delivered");
    }
    assertBranchAccess(req, lr.group.destinationBranchId);
    await assertFinalTripNotClosed(lr.group);

    const me = actorId(req);
    await db.$transaction(async (tx) => {
      await tx.lRDelivery.delete({ where: { lrId: id } });
      await tx.lorryReceipt.update({
        where: { id },
        data: {
          status: "FINALISED",
          updatedById: me,
          version: { increment: 1 },
        },
        select: { id: true },
      });
      await syncGroupDeliveryStatus(tx, lr.group.id, me);
    });

    return sendOk(res, { id, status: "FINALISED" });
  },
);

/* ------------------------------------------------------------------ */
/* Acknowledge (POD paper received back)                               */
/* ------------------------------------------------------------------ */
router.post(
  "/:id/acknowledge",
  can(PERMS.LORRY_RECEIPT.ACKNOWLEDGE),
  async (req, res) => {
    const id = getParamId(req);
    const lr = await lrForAction(id);

    if (lr.status !== "DELIVERED") {
      throw new BadRequestError(
        "Only a DELIVERED lorry receipt can be acknowledged",
      );
    }
    assertBranchAccess(req, lr.group.originBranchId);

    const parsed = acknowledgeLRSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }
    const input = parsed.data;

    const goodsIds = new Set(lr.goods.map((g) => g.id));
    for (const item of input.items ?? []) {
      if (!goodsIds.has(item.lrGoodsId)) {
        throw new BadRequestError(
          "Acknowledgement items must reference goods on this lorry receipt",
        );
      }
    }
    const me = actorId(req);

    await db.$transaction(async (tx) => {
      await tx.lRAcknowledgement.create({
        data: {
          lrId: id,
          receivedAt: input.receivedAt,
          courierName: input.courierName ?? null,
          courierDocketNo: input.courierDocketNo ?? null,
          courierCharge: input.courierCharge ?? null,
          detentionDays: input.detentionDays ?? null,
          detentionAmount: input.detentionAmount ?? null,
          damageAmount: input.damageAmount ?? null,
          remark: input.remark ?? null,
          createdById: me,
          items: (input.items ?? []).length
            ? {
                create: (input.items ?? []).map((item) => ({
                  lrGoodsId: item.lrGoodsId,
                  receivedQty: item.receivedQty ?? null,
                  damagedQty: item.damagedQty ?? null,
                })),
              }
            : undefined,
        },
        select: { id: true },
      });
      await tx.lorryReceipt.update({
        where: { id },
        data: {
          status: "ACKNOWLEDGED",
          updatedById: me,
          version: { increment: 1 },
        },
        select: { id: true },
      });
    });

    const ack = await db.lRAcknowledgement.findUniqueOrThrow({
      where: { lrId: id },
      include: ackInclude,
    });
    return sendOk(res, ack, undefined, 201);
  },
);

/* ------------------------------------------------------------------ */
/* Edit acknowledgement                                                */
/* ------------------------------------------------------------------ */
router.patch(
  "/:id/acknowledgement",
  can(PERMS.LORRY_RECEIPT.ACKNOWLEDGE),
  async (req, res) => {
    const id = getParamId(req);
    const lr = await lrForAction(id);
    if (!lr.acknowledgement) {
      throw new BadRequestError(
        "This lorry receipt has no acknowledgement record",
      );
    }
    assertBranchAccess(req, lr.group.originBranchId);

    const parsed = updateLRAcknowledgementSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }
    const input = parsed.data;

    const goodsIds = new Set(lr.goods.map((g) => g.id));
    for (const item of input.items ?? []) {
      if (!goodsIds.has(item.lrGoodsId)) {
        throw new BadRequestError(
          "Acknowledgement items must reference goods on this lorry receipt",
        );
      }
    }
    const me = actorId(req);
    const ackId = lr.acknowledgement.id;

    const updated = await db.$transaction(async (tx) => {
      if (input.items) {
        // Full replace — the dialog always submits the complete item grid.
        await tx.lRAcknowledgementItem.deleteMany({ where: { ackId } });
      }
      return tx.lRAcknowledgement.update({
        where: { id: ackId },
        data: {
          ...(input.receivedAt !== undefined
            ? { receivedAt: input.receivedAt }
            : {}),
          ...(input.courierName !== undefined
            ? { courierName: input.courierName ?? null }
            : {}),
          ...(input.courierDocketNo !== undefined
            ? { courierDocketNo: input.courierDocketNo ?? null }
            : {}),
          ...(input.courierCharge !== undefined
            ? { courierCharge: input.courierCharge ?? null }
            : {}),
          ...(input.detentionDays !== undefined
            ? { detentionDays: input.detentionDays ?? null }
            : {}),
          ...(input.detentionAmount !== undefined
            ? { detentionAmount: input.detentionAmount ?? null }
            : {}),
          ...(input.damageAmount !== undefined
            ? { damageAmount: input.damageAmount ?? null }
            : {}),
          ...(input.remark !== undefined
            ? { remark: input.remark ?? null }
            : {}),
          ...(input.items
            ? {
                items: {
                  create: input.items.map((item) => ({
                    lrGoodsId: item.lrGoodsId,
                    receivedQty: item.receivedQty ?? null,
                    damagedQty: item.damagedQty ?? null,
                  })),
                },
              }
            : {}),
          updatedById: me,
          version: { increment: 1 },
        },
        include: ackInclude,
      });
    });

    return sendOk(res, updated);
  },
);

/* ------------------------------------------------------------------ */
/* Undo acknowledgement — free until billing references it            */
/* ------------------------------------------------------------------ */
router.post(
  "/:id/undo-acknowledgement",
  can(PERMS.LORRY_RECEIPT.ACKNOWLEDGE),
  async (req, res) => {
    const id = getParamId(req);
    const lr = await lrForAction(id);

    if (lr.status !== "ACKNOWLEDGED" || !lr.acknowledgement) {
      throw new BadRequestError("This lorry receipt is not acknowledged");
    }
    assertBranchAccess(req, lr.group.originBranchId);

    const me = actorId(req);
    await db.$transaction(async (tx) => {
      await tx.lRAcknowledgement.delete({
        where: { id: lr.acknowledgement!.id },
      });
      await tx.lorryReceipt.update({
        where: { id },
        data: {
          status: "DELIVERED",
          updatedById: me,
          version: { increment: 1 },
        },
        select: { id: true },
      });
    });

    return sendOk(res, { id, status: "DELIVERED" });
  },
);

export default router;
