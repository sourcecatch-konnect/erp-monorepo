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
import {
  assertLRDeliveryEligible,
  getLRDeliveryEligibilities,
  getLRDeliveryEligibility,
} from "./lr-delivery-eligibility.service.js";
import { evaluateBillingForLR } from "../billing/billing.service.js";
import { BILLING_ELIGIBILITY_CACHE } from "../billing/billing.cache.js";
import { cached, invalidateCacheOnWrite } from "../_shared/cache.js";
import {
  LR_DELIVERY_STATS_CACHE,
  LR_DELIVERY_STATS_TTL_SECONDS,
} from "./lr-delivery.cache.js";

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
// Acknowledging / un-acknowledging an LR changes which customers are billable
// (GET /billing/eligible-clients) as well as the dashboard delivery counts.
router.use(
  invalidateCacheOnWrite(BILLING_ELIGIBILITY_CACHE, LR_DELIVERY_STATS_CACHE),
);

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
      delivery: {
        select: {
          id: true,
          deliveredAt: true,

          unloadingAt: true,
        },
      },
      acknowledgement: { select: { id: true } },
      group: {
        select: {
          id: true,
          groupNumber: true,
          originBranchId: true,
          destinationBranchId: true,
          primaryTripId: true,
          secondaryTripId: true,
          isMarketVehicle: true,
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
  group?: Record<string, unknown>;
};
const lrSingleBranchFilter = (
  req: Parameters<typeof assertBranchAccess>[0],
  branchField: "originBranchId" | "destinationBranchId",
): LRScopeWhere => {
  if (!req.ctx || req.ctx.branchScope === "ALL") return {};
  if (req.ctx.branchIds.length === 0) {
    return { id: { in: [] as string[] } };
  }
  return {
    group: { [branchField]: { in: req.ctx.branchIds } },
  };
};

const lrOriginBranchFilter = (req: Parameters<typeof assertBranchAccess>[0]) =>
  lrSingleBranchFilter(req, "originBranchId");

const lrDestinationBranchFilter = (
  req: Parameters<typeof assertBranchAccess>[0],
) => lrSingleBranchFilter(req, "destinationBranchId");

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
    const scope = lrDestinationBranchFilter(req);
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
    const eligibility = await getLRDeliveryEligibilities(
      data.map((lr) => lr.id),
    );
    return sendOk(
      res,
      data.flatMap((lr) => {
        const deliveryEligibility = eligibility.get(lr.id);
        return deliveryEligibility?.eligible
          ? [{ ...lr, deliveryEligibility }]
          : [];
      }),
    );
  },
);

/** DELIVERED-but-not-ACKNOWLEDGED LRs — POD paper still in the field. */
router.get(
  "/worklists/pending-pod",
  can(PERMS.LORRY_RECEIPT.VIEW),
  async (req, res) => {
    const scope = lrOriginBranchFilter(req);
    const data = await db.lorryReceipt.findMany({
      where: {
        deletedAt: null,
        status: "DELIVERED",
        ...(scope.id ? { id: scope.id } : {}),
        ...(scope.group ? { group: scope.group } : {}),
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

type DeliveryStatsScopes = {
  scope: ReturnType<typeof lrBranchFilter>;
  destinationScope: ReturnType<typeof lrDestinationBranchFilter>;
  originScope: ReturnType<typeof lrOriginBranchFilter>;
};

const computeDeliveryStats = async ({
  scope,
  destinationScope,
  originScope,
}: DeliveryStatsScopes) => {
  const lrScope = {
    ...(scope.id ? { id: scope.id } : {}),
    ...(scope.group ? { group: scope.group } : {}),
  };

  const [pendingCandidates, atHub, pendingPod, recentDeliveries] =
    await Promise.all([
      db.lorryReceipt.findMany({
        where: {
          deletedAt: null,
          status: "FINALISED",
          ...(destinationScope.id ? { id: destinationScope.id } : {}),
          group: {
            ...(destinationScope.group ?? {}),
            status: "FINALISED",
            deletedAt: null,
            NOT: { hubId: { not: null }, secondaryTripId: null },
          },
        },
        select: { id: true },
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
        where: {
          deletedAt: null,
          status: "DELIVERED",
          ...(originScope.id ? { id: originScope.id } : {}),
          ...(originScope.group ? { group: originScope.group } : {}),
        },
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

  const pendingEligibility = await getLRDeliveryEligibilities(
    pendingCandidates.map((lr) => lr.id),
  );
  const pendingDelivery = [...pendingEligibility.values()].filter(
    (eligibility) => eligibility.eligible,
  ).length;

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

  return { pendingDelivery, atHub, pendingPod, avgDeliveryDays };
};

/**
 * Counts + average delivery days for the dashboard cards. Every card load
 * used to scan all FINALISED LRs and run the delivery-eligibility check on
 * each; now it's cached per branch scope. Writes on this router and on the LR
 * group router (which also creates deliveries) invalidate it, and the short
 * TTL bounds staleness for changes made through other modules (e.g. trips).
 */
router.get(
  "/worklists/delivery-stats",
  can(PERMS.LORRY_RECEIPT.VIEW),
  async (req, res) => {
    const scopes: DeliveryStatsScopes = {
      scope: lrBranchFilter(req),
      destinationScope: lrDestinationBranchFilter(req),
      originScope: lrOriginBranchFilter(req),
    };

    const stats = await cached(
      {
        namespace: LR_DELIVERY_STATS_CACHE,
        key: scopes,
        ttlSeconds: LR_DELIVERY_STATS_TTL_SECONDS,
      },
      () => computeDeliveryStats(scopes),
    );

    return sendOk(res, stats);
  },
);

/** Branch-scoped operational report derived from LR delivery + POD records. */
router.get(
  "/reports/unloading",
  can(PERMS.LORRY_RECEIPT.VIEW),
  async (req, res) => {
    const scope = lrBranchFilter(req);
    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";
    const status =
      req.query.status === "DELIVERED" || req.query.status === "ACKNOWLEDGED"
        ? req.query.status
        : undefined;
    const from =
      typeof req.query.dateFrom === "string" && req.query.dateFrom
        ? new Date(`${req.query.dateFrom}T00:00:00.000`)
        : undefined;
    const to =
      typeof req.query.dateTo === "string" && req.query.dateTo
        ? new Date(`${req.query.dateTo}T23:59:59.999`)
        : undefined;

    if (
      (from && Number.isNaN(from.getTime())) ||
      (to && Number.isNaN(to.getTime()))
    ) {
      throw new BadRequestError("Invalid report date range");
    }
    if (from && to && from > to) {
      throw new BadRequestError("From date cannot be after to date");
    }

    const lrs = await db.lorryReceipt.findMany({
      where: {
        deletedAt: null,
        status: status ?? { in: ["DELIVERED", "ACKNOWLEDGED"] },
        ...(scope.id ? { id: scope.id } : {}),
        ...(scope.group ? { group: scope.group } : {}),
        ...(search
          ? {
            OR: [
              { lrNumber: { contains: search, mode: "insensitive" } },
              {
                group: {
                  consignor: {
                    name: { contains: search, mode: "insensitive" },
                  },
                },
              },
              {
                group: {
                  consignee: {
                    name: { contains: search, mode: "insensitive" },
                  },
                },
              },
            ],
          }
          : {}),
        delivery: {
          is: {
            ...(from || to
              ? {
                deliveredAt: {
                  ...(from ? { gte: from } : {}),
                  ...(to ? { lte: to } : {}),
                },
              }
              : {}),
          },
        },
      },
      select: {
        id: true,
        lrNumber: true,
        createdAt: true,
        status: true,
        group: {
          select: {
            consignor: { select: { name: true } },
            consignee: { select: { name: true } },
            originBranch: { select: { name: true } },
            destinationBranch: { select: { name: true } },
          },
        },
        delivery: {
          select: {
            reportedAt: true,
            unloadingAt: true,
            deliveredAt: true,
            receiverName: true,
          },
        },
        acknowledgement: {
          select: {
            receivedAt: true,
            courierName: true,
            courierDocketNo: true,
            detentionDays: true,
            detentionAmount: true,
          },
        },
      },
      orderBy: { delivery: { deliveredAt: "desc" } },
      take: 2000,
    });

    const challanItems = lrs.length
      ? await db.deliveryChallanItem.findMany({
        where: {
          lrNumberSnapshot: { in: lrs.map((lr) => lr.lrNumber) },
          deliveryChallan: { status: { not: "CANCELLED" } },
        },
        select: {
          lrNumberSnapshot: true,
          deliveryChallan: { select: { challanNumber: true } },
        },
      })
      : [];
    const challansByLr = new Map<string, Set<string>>();
    for (const item of challanItems) {
      const numbers =
        challansByLr.get(item.lrNumberSnapshot) ?? new Set<string>();
      numbers.add(item.deliveryChallan.challanNumber);
      challansByLr.set(item.lrNumberSnapshot, numbers);
    }

    return sendOk(
      res,
      lrs.map((lr) => ({
        id: lr.id,
        lrNumber: lr.lrNumber,
        lrDate: lr.createdAt,
        status: lr.status,
        consignorName: lr.group.consignor?.name ?? null,
        consigneeName: lr.group.consignee?.name ?? null,
        originBranchName: lr.group.originBranch?.name ?? null,
        destinationBranchName: lr.group.destinationBranch?.name ?? null,
        challanNumbers: [...(challansByLr.get(lr.lrNumber) ?? [])],
        reportedAt: lr.delivery?.reportedAt ?? null,
        unloadingAt: lr.delivery?.unloadingAt ?? null,
        deliveredAt: lr.delivery!.deliveredAt,
        receiverName: lr.delivery?.receiverName ?? null,
        podReceivedAt: lr.acknowledgement?.receivedAt ?? null,
        courierName: lr.acknowledgement?.courierName ?? null,
        courierDocketNo: lr.acknowledgement?.courierDocketNo ?? null,
        detentionDays: lr.acknowledgement?.detentionDays ?? null,
        detentionAmount: lr.acknowledgement?.detentionAmount ?? null,
      })),
    );
  },
);

/** Complete read-only view behind one unloading-report row. */
router.get(
  "/reports/unloading/:id",
  can(PERMS.LORRY_RECEIPT.VIEW),
  async (req, res) => {
    const id = getParamId(req);
    const scope = lrBranchFilter(req);
    const lr = await db.lorryReceipt.findFirst({
      where: {
        id,
        deletedAt: null,
        status: { in: ["DELIVERED", "ACKNOWLEDGED"] },
        ...(scope.group ? { group: scope.group } : {}),
        ...(scope.id ? { id: scope.id } : {}),
      },
      select: {
        id: true,
        lrNumber: true,
        createdAt: true,
        status: true,
        invoiceNumber: true,
        invoiceAmount: true,
        totalWeight: true,
        unit: true,
        group: {
          select: {
            id: true,
            groupNumber: true,
            transportType: true,
            consignor: { select: { name: true } },
            consignee: { select: { name: true } },
            originBranch: { select: { name: true } },
            destinationBranch: { select: { name: true } },
            sourceRailheadArea: {
              select: { name: true, city: { select: { name: true } } },
            },
            destinationRailheadArea: {
              select: { name: true, city: { select: { name: true } } },
            },
          },
        },
        loadingLocation: {
          select: {
            name: true,
            address: true,
            city: { select: { name: true } },
          },
        },
        unloadingLocation: {
          select: {
            name: true,
            address: true,
            city: { select: { name: true } },
          },
        },
        goods: {
          select: {
            id: true,
            name: true,
            description: true,
            quantity: true,
            unit: true,
          },
          orderBy: { createdAt: "asc" },
        },
        delivery: {
          select: {
            reportedAt: true,
            unloadingAt: true,
            deliveredAt: true,
            receiverName: true,
            receiverPhone: true,
            unloadingCharges: true,
            remark: true,
            createdBy: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        acknowledgement: {
          select: {
            receivedAt: true,
            courierName: true,
            courierDocketNo: true,
            courierCharge: true,
            detentionDays: true,
            detentionAmount: true,
            damageAmount: true,
            remark: true,
            createdBy: {
              select: { firstName: true, lastName: true },
            },
            items: {
              select: {
                lrGoodsId: true,
                receivedQty: true,
                damagedQty: true,
              },
            },
          },
        },
      },
    });

    if (!lr?.delivery) {
      throw new NotFoundError("Unloading record not found");
    }

    const challanItems = await db.deliveryChallanItem.findMany({
      where: {
        lrNumberSnapshot: lr.lrNumber,
        deliveryChallan: { status: { not: "CANCELLED" } },
      },
      select: {
        quantity: true,
        deliveryChallan: {
          select: {
            id: true,
            challanNumber: true,
            status: true,
            loadingAt: true,
            issuedAt: true,
            vehicleNumberSnapshot: true,
            vehicle: { select: { vehicleNumber: true } },
            driverName: true,
          },
        },
      },
    });
    const challans = new Map<
      string,
      (typeof challanItems)[number]["deliveryChallan"] & { quantity: number }
    >();
    for (const item of challanItems) {
      const current = challans.get(item.deliveryChallan.id);
      challans.set(item.deliveryChallan.id, {
        ...item.deliveryChallan,
        quantity: (current?.quantity ?? 0) + item.quantity,
      });
    }

    const personName = (
      person?: {
        firstName: string;
        lastName: string;
      } | null,
    ) =>
      person ? `${person.firstName} ${person.lastName}`.trim() || null : null;
    const location = (value: typeof lr.loadingLocation) =>
      value
        ? {
          name: value.name,
          address: value.address,
          cityName: value.city.name,
        }
        : null;
    const railhead = (value: typeof lr.group.sourceRailheadArea) =>
      value ? { name: value.name, cityName: value.city.name } : null;

    return sendOk(res, {
      id: lr.id,
      lrNumber: lr.lrNumber,
      lrDate: lr.createdAt,
      status: lr.status,
      groupId: lr.group.id,
      groupNumber: lr.group.groupNumber,
      transportType: lr.group.transportType,
      invoiceNumber: lr.invoiceNumber,
      invoiceAmount: lr.invoiceAmount,
      totalWeight: lr.totalWeight,
      weightUnit: lr.unit,
      consignorName: lr.group.consignor?.name ?? null,
      consigneeName: lr.group.consignee?.name ?? null,
      originBranchName: lr.group.originBranch?.name ?? null,
      destinationBranchName: lr.group.destinationBranch?.name ?? null,
      loadingLocation: location(lr.loadingLocation),
      unloadingLocation: location(lr.unloadingLocation),
      sourceRailhead: railhead(lr.group.sourceRailheadArea),
      destinationRailhead: railhead(lr.group.destinationRailheadArea),
      reportedAt: lr.delivery.reportedAt,
      unloadingAt: lr.delivery.unloadingAt,
      deliveredAt: lr.delivery.deliveredAt,
      receiverName: lr.delivery.receiverName,
      podReceivedAt: lr.acknowledgement?.receivedAt ?? null,
      courierName: lr.acknowledgement?.courierName ?? null,
      courierDocketNo: lr.acknowledgement?.courierDocketNo ?? null,
      detentionDays: lr.acknowledgement?.detentionDays ?? null,
      detentionAmount: lr.acknowledgement?.detentionAmount ?? null,
      challanNumbers: [...challans.values()].map((row) => row.challanNumber),
      delivery: {
        ...lr.delivery,
        recordedBy: personName(lr.delivery.createdBy),
        createdBy: undefined,
      },
      acknowledgement: lr.acknowledgement
        ? {
          ...lr.acknowledgement,
          recordedBy: personName(lr.acknowledgement.createdBy),
          createdBy: undefined,
        }
        : null,
      goods: lr.goods,
      deliveryChallans: [...challans.values()].map((row) => ({
        id: row.id,
        challanNumber: row.challanNumber,
        status: row.status,
        loadingAt: row.loadingAt,
        issuedAt: row.issuedAt,
        vehicleNumber: row.vehicle?.vehicleNumber ?? row.vehicleNumberSnapshot,
        driverName: row.driverName,
        quantity: row.quantity,
      })),
    });
  },
);

/* ------------------------------------------------------------------ */
/* Mark delivered                                                      */
/* ------------------------------------------------------------------ */
router.get(
  "/:id/delivery-eligibility",
  can(PERMS.LORRY_RECEIPT.VIEW),
  async (req, res) => {
    const id = getParamId(req);
    const lr = await lrForAction(id);
    assertBranchAccess(req, lr.group.destinationBranchId);
    return sendOk(res, await getLRDeliveryEligibility(id));
  },
);

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
    assertLRDeliveryEligible(await getLRDeliveryEligibility(id));

    const parsed = deliverLRSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }
    const input = parsed.data;
    const me = actorId(req);

    await db.$transaction(async (tx) => {
      assertLRDeliveryEligible(await getLRDeliveryEligibility(id, tx));
      await tx.lRDelivery.create({
        data: {
          lrId: id,
          deliveredAt: input.deliveredAt,

          unloadingAt: input.unloadingAt ?? null,
          receiverName: input.receiverName ?? null,
          receiverPhone: input.receiverPhone ?? null,
          unloadingCharges: lr.group.isMarketVehicle
            ? (input.unloadingCharges ?? null)
            : null,
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
    const deliveredAt = input.deliveredAt ?? lr.delivery.deliveredAt;
    const unloadingAt = input.unloadingAt ?? lr.delivery.unloadingAt;

    if (unloadingAt && unloadingAt < deliveredAt) {
      throw new BadRequestError(
        "Unloading completion cannot be before delivery time",
      );
    }
    const me = actorId(req);

    const updated = await db.lRDelivery.update({
      where: { lrId: id },
      data: {
        ...(input.deliveredAt !== undefined
          ? { deliveredAt: input.deliveredAt }
          : {}),

        ...(input.unloadingAt !== undefined
          ? { unloadingAt: input.unloadingAt ?? null }
          : {}),
        ...(input.receiverName !== undefined
          ? { receiverName: input.receiverName ?? null }
          : {}),
        ...(input.receiverPhone !== undefined
          ? { receiverPhone: input.receiverPhone ?? null }
          : {}),
        ...(lr.group.isMarketVehicle
          ? input.unloadingCharges !== undefined
            ? { unloadingCharges: input.unloadingCharges ?? null }
            : {}
          : { unloadingCharges: null }),
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

    await evaluateBillingForLR(db, id, me);

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

    const activeBillLine = await db.billLine.findFirst({
      where: { lrId: id, bill: { status: { not: "CANCELLED" } } },
      select: { id: true },
    });
    if (activeBillLine) {
      throw new BadRequestError(
        "Cancel active billing drafts before changing an acknowledgement",
      );
    }

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

    await evaluateBillingForLR(db, id, me);

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

    const billedCharge = await db.billLine.findFirst({
      where: { lrId: id, bill: { status: { not: "CANCELLED" } } },
      select: { id: true },
    });
    if (billedCharge) {
      throw new BadRequestError(
        "Cancel every active draft/final bill for this LR before undoing acknowledgement",
      );
    }

    const me = actorId(req);
    await db.$transaction(async (tx) => {
      await tx.lRCharge.deleteMany({ where: { lrId: id } });
      await tx.lRAcknowledgement.delete({
        where: { id: lr.acknowledgement!.id },
      });
      await tx.lorryReceipt.update({
        where: { id },
        data: {
          status: "DELIVERED",
          billingStatus: "NOT_BILLABLE",
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
