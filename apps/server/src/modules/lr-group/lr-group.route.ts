import { Router } from "express";
import {
  createLRGroupSchema,
  updateLRGroupSchema,
  finaliseGroupSchema,
  splitGroupAtHubSchema,
  cancelGroupSchema,
  lrGroupLineSchema,
  deliverGroupSchema,
  holdGroupAtHubSchema,
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
import type { LRGroupStatus } from "../../../generated/prisma/index.js";
import {
  generateLRNumber,
  generateLRNumbers,
  resolveHubBranchId,
} from "../lorry-receipt/lorry-receipt.service.js";
import {
  publishLRDelivered,
  syncGroupDeliveryStatus,
} from "../lorry-receipt/lr-delivery.service.js";
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
  length: number | null;
  width: number | null;
  height: number | null;
};

type LRLineCreate = {
  loadingLocationId: string | null;
  unloadingLocationId: string | null;
  totalWeight: number | null;
  unit: string | null;
  goods: LRGoodsCreate[];
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
      ? {
          groupNumber: { contains: query.search, mode: "insensitive" as const },
        }
      : {}),
  };

  const [groups, total] = await Promise.all([
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
  const data = groups.map((group) => ({
    ...group,
    lrCount: group.lorryReceipts.length,
  }));

  return sendOk(res, data, { page: query.page, size: query.size, total });
});

/* ------------------------------------------------------------------ */
/* Status counts                                                       */
/* ------------------------------------------------------------------ */
router.get(
  "/status-counts",
  can(PERMS.LORRY_RECEIPT.VIEW),
  async (req, res) => {
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
  },
);

/* ------------------------------------------------------------------ */
/* At-hub worklist — groups lying at Jalgaon awaiting leg-2 dispatch    */
/* ------------------------------------------------------------------ */
router.get(
  "/worklists/at-hub",
  can(PERMS.LORRY_RECEIPT.VIEW),
  async (req, res) => {
    const data = await db.lRGroup.findMany({
      where: {
        deletedAt: null,
        status: "FINALISED",
        hubId: { not: null },
        secondaryTripId: null,
        ...groupBranchFilter(req),
      },
      select: {
        id: true,
        groupNumber: true,
        hubArrivalAt: true,
        finalisedAt: true,
        consignee: { select: { id: true, name: true, shortName: true } },
        originBranch: { select: { id: true, name: true, branchCode: true } },
        destinationBranch: {
          select: { id: true, name: true, branchCode: true },
        },
        hub: { select: { id: true, name: true } },
        lorryReceipts: {
          where: { deletedAt: null },
          select: { id: true, lrNumber: true },
        },
      },
      orderBy: { hubArrivalAt: "asc" },
      take: 500,
    });
    return sendOk(res, data);
  },
);

/* ------------------------------------------------------------------ */
/* Detail                                                              */
/* ------------------------------------------------------------------ */
router.get("/:id", can(PERMS.LORRY_RECEIPT.VIEW), async (req, res) => {
  const rawIdentifier = getParamId(req);
  const identifier = decodeURIComponent(rawIdentifier).trim();

  const branchFilter = groupBranchFilter(req);

  const group = await db.lRGroup.findFirst({
    where: {
      AND: [
        { deletedAt: null },
        branchFilter,
        {
          OR: [{ id: identifier }, { groupNumber: identifier }],
        },
      ],
    },
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

  // ---- Resolve everything read-only BEFORE opening a transaction. Reads,
  // branch checks and sequence generation all run outside the write transaction
  // so the interactive transaction stays tiny and well under Prisma's 5s budget
  // (see "Database transactions" in CLAUDE.md). ----
  let originBranchId: string;
  let destinationBranchId: string;
  let consignorId: string;
  let consigneeId: string;
  let orderId: string | null = null;
  let truckIndex = 1;
  // Each LR is one consignment: its loading/unloading location + goods lines.
  let lines: LRLineCreate[];

  if (input.source === "FROM_ORDER") {
    const order = await db.order.findUnique({
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
      throw new BadRequestError(
        "A group can only be created for a Confirmed order",
      );
    }
    if (order.orderType !== "Truck") {
      throw new BadRequestError("Only Truck orders support group creation");
    }
    if (!order.truckQuantity) {
      throw new BadRequestError("Order has no truck quantity set");
    }
    if (!order.consigneeId) {
      throw new BadRequestError(
        "Set the order's consignee before creating a group",
      );
    }

    truckIndex = input.truckIndex ?? 1;
    await assertGroupSlotAvailable(
      db,
      order.id,
      order.truckQuantity,
      truckIndex,
    );

    const consignments = await db.orderConsignment.findMany({
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
      totalWeight: c.totalWeight != null ? Number(c.totalWeight) : null,
      unit: c.unit ?? null,
      goods: c.goods.map((g) => ({
        name: g.goods.name,
        description: null,
        quantity: g.quantity,
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
    lines = (input.lrs ?? []).map((l) => ({
      loadingLocationId: l.loadingLocationId ?? null,
      unloadingLocationId: l.unloadingLocationId ?? null,
      totalWeight: l.totalWeight ?? null,
      unit: l.totalWeightUnit ?? null,
      goods: l.goods.map((g) => ({
        name: g.name,
        description: g.description ?? null,
        quantity: g.quantity,
        length: g.length ?? null,
        width: g.width ?? null,
        height: g.height ?? null,
      })),
    }));
  }

  // Origin-branch access check.
  assertBranchAccess(req, originBranchId);

  const originBranch = await db.branch.findUnique({
    where: { id: originBranchId },
    select: { branchCode: true },
  });
  if (!originBranch) throw new BadRequestError("Origin branch not found");

  const now = new Date();
  const fyCode = fyCodeFor(now);
  const groupNumber = await generateGroupNumber(
    db,
    originBranch.branchCode,
    fyCode,
  );
  // One upsert reserves a contiguous block of LR numbers (no per-line round-trip).
  const lrNumbers = lines.length
    ? await generateLRNumbers(db, originBranch.branchCode, fyCode, lines.length)
    : [];
  const isMarketVehicle = input.isMarketVehicle ?? false;
  const activeStatuses: LRGroupStatus[] = ["DRAFT", "FINALISED"];
  const marketVehicleNumber =
    isMarketVehicle && input.marketVehicleNumber
      ? input.marketVehicleNumber.toUpperCase().replace(/\s+/g, "")
      : null;
  const marketDriverName =
    isMarketVehicle && input.marketDriverName
      ? input.marketDriverName.trim()
      : null;

  if (marketVehicleNumber) {
    const busyVehicle = await db.lRGroup.findFirst({
      where: {
        deletedAt: null,
        status: { in: activeStatuses },
        isMarketVehicle: true,
        marketVehicleNumber,
      },
      select: {
        id: true,
        groupNumber: true,
        status: true,
      },
    });

    if (busyVehicle) {
      throw new BadRequestError(
        `Vehicle ${marketVehicleNumber} is already assigned to LR group ${busyVehicle.groupNumber}`,
      );
    }
  }

  if (marketDriverName) {
    const busyDriver = await db.lRGroup.findFirst({
      where: {
        deletedAt: null,
        status: { in: activeStatuses },
        isMarketVehicle: true,
        marketDriverName: {
          equals: marketDriverName,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        groupNumber: true,
        status: true,
      },
    });

    if (busyDriver) {
      throw new BadRequestError(
        `Driver ${marketDriverName} is already assigned to LR group ${busyDriver.groupNumber}`,
      );
    }
  }
  const transportType =
    input.source === "INSTANT" ? "Road" : (input.transportType ?? "Road");
  const tripLegType =
    input.source === "FROM_ORDER" ? (input.tripLegType ?? "DIRECT") : "DIRECT";
  const hubId = tripLegType === "DIRECT" ? null : await resolveHubBranchId(db);
  const railheadBranchId =
    input.source === "FROM_ORDER" ? (input.railheadBranchId ?? null) : null;
  const primaryTripId = !isMarketVehicle ? (input.primaryTripId ?? null) : null;
  if (!isMarketVehicle && primaryTripId) {
    const trip = await db.vehicleTrip.findUnique({
      where: { id: primaryTripId },
      select: {
        id: true,
        status: true,
        tripName: true,
        consignorId: true,
        vehicle: { select: { vehicleNumber: true } },
        driver: { select: { name: true } },
      },
    });

    if (!trip) {
      throw new BadRequestError("Trip not found");
    }

    if (trip.status !== "Planned") {
      throw new BadRequestError(
        `Trip ${trip.tripName} is not available. Current status is ${trip.status}`,
      );
    }

    if (trip.consignorId !== consignorId) {
      throw new BadRequestError(
        `Trip ${trip.tripName} belongs to a different consignor and cannot be attached to this LR.`,
      );
    }

    const busyGroup = await db.lRGroup.findFirst({
      where: {
        deletedAt: null,
        status: { in: activeStatuses },
        OR: [{ primaryTripId }, { secondaryTripId: primaryTripId }],
      },
      select: {
        groupNumber: true,
      },
    });

    if (busyGroup) {
      throw new BadRequestError(
        `Trip ${trip.tripName} is already assigned to LR group ${busyGroup.groupNumber}`,
      );
    }
  }
  // ---- Writes only: create the group + its LRs and dispatch the trip. The
  // heavy detail include is fetched AFTER commit, not inside the transaction. ----
  const created = await db.$transaction(
    async (tx) => {
      const group = await tx.lRGroup.create({
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
          marketVehicleNumber,
          marketDriverName,

          marketFreightAmount: isMarketVehicle
            ? (input.marketFreightAmount ?? null)
            : null,
          marketAdvanceAmount: isMarketVehicle
            ? (input.marketAdvanceAmount ?? null)
            : null,
          marketCommissionAmount: isMarketVehicle
            ? (input.marketCommissionAmount ?? null)
            : null,
          marketHamaliAmount: isMarketVehicle
            ? (input.marketHamaliAmount ?? null)
            : null,
          marketTdsAmount: isMarketVehicle
            ? (input.marketTdsAmount ?? null)
            : null,
          status: "DRAFT",
          createdById: me,
          lorryReceipts: lines.length
            ? {
                create: lines.map((line, i) => ({
                  lrNumber: lrNumbers[i]!,
                  fyCode,
                  loadingLocationId: line.loadingLocationId,
                  unloadingLocationId: line.unloadingLocationId,
                  totalWeight: line.totalWeight,
                  unit: line.unit,
                  status: "DRAFT",
                  createdById: me,
                  goods: line.goods.length ? { create: line.goods } : undefined,
                })),
              }
            : undefined,
        },
        select: { id: true, groupNumber: true },
      });

      // Own-vehicle group attached to a Planned trip dispatches it (-> InTransit).
      if (primaryTripId) {
        await dispatchTripOnAttach(tx, primaryTripId, group.groupNumber, me);
      }

      if (input.source === "FROM_ORDER" && orderId) {
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: "LRCreated",
            updatedById: me,
            version: { increment: 1 },
          },
        });
      }

      return group;
    },
    { timeout: 15000, maxWait: 10000 },
  );

  const group = await db.lRGroup.findUniqueOrThrow({
    where: { id: created.id },
    include: groupDetailInclude,
  });

  return sendOk(res, group, undefined, 201);
});

/* ------------------------------------------------------------------ */
/* Update draft                                                        */
/* ------------------------------------------------------------------ */
router.patch("/:id", can(PERMS.LORRY_RECEIPT.UPDATE), async (req, res) => {
  const id = getParamId(req);
  const existing = await db.lRGroup.findFirst({
    where: { id, deletedAt: null },
    include: {
      lorryReceipts: true,
    },
  });
  if (!existing) throw new NotFoundError("Lorry receipt group not found");
  if (existing.lorryReceipts.length === 0) {
    throw new BadRequestError(
      "Add at least one LR before finalising the group",
    );
  }
  assertBranchAccess(req, existing.originBranchId);

  const parsed = updateLRGroupSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const input = parsed.data;
  const me = actorId(req);

  const nextIsMarketVehicle =
    input.isMarketVehicle !== undefined
      ? input.isMarketVehicle
      : existing.isMarketVehicle;

  const nextPrimaryTripId = nextIsMarketVehicle
    ? null
    : input.primaryTripId !== undefined
      ? (input.primaryTripId ?? null)
      : existing.primaryTripId;

  if (nextPrimaryTripId && nextPrimaryTripId !== existing.primaryTripId) {
    const trip = await db.vehicleTrip.findUnique({
      where: { id: nextPrimaryTripId },
      select: { id: true, tripName: true, consignorId: true },
    });
    if (!trip) throw new BadRequestError("Trip not found");
    if (trip.consignorId !== existing.consignorId) {
      throw new BadRequestError(
        `Trip ${trip.tripName} belongs to a different consignor and cannot be attached to this LR.`,
      );
    }
  }

  const updated = await db.lRGroup.update({
    where: { id },
    data: {
      ...(input.consigneeId !== undefined
        ? { consigneeId: input.consigneeId }
        : {}),
      ...(input.transportType ? { transportType: input.transportType } : {}),
      ...(input.railheadBranchId !== undefined
        ? { railheadBranchId: input.railheadBranchId ?? null }
        : {}),
      ...(input.priority ? { priority: input.priority } : {}),

      isMarketVehicle: nextIsMarketVehicle,

      // If market vehicle, clear own trip.
      // If own vehicle, allow trip and clear market vehicle values.
      primaryTripId: nextPrimaryTripId,

      marketVehicleNumber: nextIsMarketVehicle
        ? input.marketVehicleNumber !== undefined
          ? (input.marketVehicleNumber ?? null)
          : existing.marketVehicleNumber
        : null,

      marketDriverName: nextIsMarketVehicle
        ? input.marketDriverName !== undefined
          ? (input.marketDriverName ?? null)
          : existing.marketDriverName
        : null,

      marketFreightAmount: nextIsMarketVehicle
        ? input.marketFreightAmount !== undefined
          ? (input.marketFreightAmount ?? null)
          : existing.marketFreightAmount
        : null,

      marketAdvanceAmount: nextIsMarketVehicle
        ? input.marketAdvanceAmount !== undefined
          ? (input.marketAdvanceAmount ?? null)
          : existing.marketAdvanceAmount
        : null,

      marketCommissionAmount: nextIsMarketVehicle
        ? input.marketCommissionAmount !== undefined
          ? (input.marketCommissionAmount ?? null)
          : existing.marketCommissionAmount
        : null,

      marketHamaliAmount: nextIsMarketVehicle
        ? input.marketHamaliAmount !== undefined
          ? (input.marketHamaliAmount ?? null)
          : existing.marketHamaliAmount
        : null,

      marketTdsAmount: nextIsMarketVehicle
        ? input.marketTdsAmount !== undefined
          ? (input.marketTdsAmount ?? null)
          : existing.marketTdsAmount
        : null,

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
router.post(
  "/:id/finalise",
  can(PERMS.LORRY_RECEIPT.APPROVE),
  async (req, res) => {
    const id = getParamId(req);

    const existing = await db.lRGroup.findFirst({
      where: { id, deletedAt: null },
      include: {
        lorryReceipts: {
          where: { deletedAt: null },
          select: {
            id: true,
            status: true,
            loadingLocationId: true,
            unloadingLocationId: true,
            totalWeight: true,
            unit: true,
            ewayBill: { select: { id: true } },
            goods: { select: { id: true } },
          },
        },
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

    const existingLrsById = new Map(
      existing.lorryReceipts.map((lr) => [lr.id, lr]),
    );

    // Do all validation BEFORE transaction.
    for (const line of lrs) {
      const lr = existingLrsById.get(line.lrId);
      if (
        !lr ||
        !lr.loadingLocationId ||
        !lr.unloadingLocationId ||
        lr.goods.length === 0 ||
        lr.totalWeight == null ||
        !lr.unit
      ) {
        throw new BadRequestError(
          "Add loading point, unloading point, goods, total weight, and unit to every LR before finalising the group",
        );
      }

      if (line.existingEwayBillId) {
        if (lr?.ewayBill?.id !== line.existingEwayBillId) {
          throw new BadRequestError(
            "Existing e-way bill does not belong to this LR",
          );
        }
      } else if (line.ewayBill && lr.ewayBill) {
        throw new BadRequestError("This LR already has an e-way bill");
      }
    }

    await db.$transaction(async (tx) => {
      for (const line of lrs) {
        if (line.ewayBill && !line.existingEwayBillId) {
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
        }

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

      await tx.lRGroup.update({
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
        select: { id: true },
      });
    });

    // Fetch heavy detail AFTER transaction commit.
    const updated = await db.lRGroup.findUniqueOrThrow({
      where: { id },
      include: groupDetailInclude,
    });

    return sendOk(res, updated);
  },
);
/* ------------------------------------------------------------------ */
/* Hold at hub (HO action) — goods unloaded at Jalgaon, awaiting leg 2  */
/* ------------------------------------------------------------------ */
/**
 * First half of the decomposed hub split (docs/LR_DELIVERY_ACK_PLAN.md §5).
 * Marks the group as lying at the head-office hub, which exempts its leg-1
 * trip from the close delivery gate and puts it on the "at hub" worklist.
 */
router.post(
  "/:id/hold-at-hub",
  can(PERMS.LORRY_RECEIPT.APPROVE),
  async (req, res) => {
    const id = getParamId(req);
    const existing = await db.lRGroup.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        status: true,
        secondaryTripId: true,
        hubId: true,
        lorryReceipts: {
          where: { deletedAt: null },
          select: {
            delivery: { select: { id: true } },
          },
        },
      },
    });
    if (!existing) throw new NotFoundError("Lorry receipt group not found");
    if (existing.status !== "FINALISED") {
      throw new BadRequestError(
        "Only a finalised group can be held at the hub",
      );
    }
    if (existing.lorryReceipts.some((lr) => lr.delivery)) {
      throw new BadRequestError(
        "Hold at hub is only allowed before any lorry receipt is delivered",
      );
    }
    if (existing.secondaryTripId) {
      throw new BadRequestError(
        "This group has already been dispatched from the hub",
      );
    }
    if (existing.hubId) {
      throw new BadRequestError("This group is already held at the hub");
    }

    const parsed = holdGroupAtHubSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }
    const me = actorId(req);
    const hubId = await resolveHubBranchId(db);

    const updated = await db.lRGroup.update({
      where: { id },
      data: {
        hubId,
        hubArrivalAt: parsed.data.hubArrivalAt ?? new Date(),
        tripLegType: "TO_HUB",
        updatedById: me,
        version: { increment: 1 },
      },
      include: groupDetailInclude,
    });

    return sendOk(res, updated);
  },
);

/* ------------------------------------------------------------------ */
/* Dispatch from hub (HO action) — attach the leg-2 trip               */
/* ------------------------------------------------------------------ */
/**
 * Second half of the decomposed hub split: the group must already be held at
 * the hub. Attaching the leg-2 trip makes it the group's final trip, so the
 * close delivery gate moves onto leg 2.
 */
router.post(
  "/:id/dispatch-from-hub",
  can(PERMS.LORRY_RECEIPT.APPROVE),
  async (req, res) => {
    const id = getParamId(req);
    const existing = await db.lRGroup.findFirst({
      where: { id, deletedAt: null },
      include: {
        lorryReceipts: {
          select: {
            id: true,
            delivery: { select: { id: true } },
          },
        },
      },
    });
    if (!existing) throw new NotFoundError("Lorry receipt group not found");
    if (existing.status !== "FINALISED") {
      throw new BadRequestError(
        "Hub dispatch is only allowed on a finalised group",
      );
    }
    if (!existing.hubId) {
      throw new BadRequestError(
        "Hold the group at the hub before dispatching it",
      );
    }
    if (existing.lorryReceipts.some((lr) => lr.delivery)) {
      throw new BadRequestError(
        "Dispatch from hub is only allowed before any lorry receipt is delivered",
      );
    }
    if (existing.secondaryTripId) {
      throw new BadRequestError(
        "This group has already been dispatched from the hub",
      );
    }

    const parsed = splitGroupAtHubSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }
    const { secondaryTripId } = parsed.data;
    const me = actorId(req);

    // Leg 1 must have completed before the hub -> destination leg picks up.
    if (existing.primaryTripId) {
      const leg1 = await db.vehicleTrip.findUnique({
        where: { id: existing.primaryTripId },
        select: { status: true },
      });
      if (leg1 && leg1.status !== "Closed") {
        throw new BadRequestError(
          "The leg 1 trip must be Closed before attaching a leg 2 trip",
        );
      }
    }

    const leg2 = await db.vehicleTrip.findUnique({
      where: { id: secondaryTripId },
      select: { id: true, status: true, consignorId: true },
    });
    if (!leg2) throw new BadRequestError("Leg 2 trip not found");
    if (secondaryTripId === existing.primaryTripId) {
      throw new BadRequestError("Leg 2 trip must differ from the leg 1 trip");
    }
    if (leg2.status !== "Planned") {
      throw new BadRequestError("Leg 2 trip must be a Planned trip");
    }
    if (leg2.consignorId !== existing.consignorId) {
      throw new BadRequestError(
        "Leg 2 trip belongs to a different consignor and cannot be attached to this LR",
      );
    }

    const updated = await db.$transaction(async (tx) => {
      const result = await tx.lRGroup.update({
        where: { id },
        data: {
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
  },
);
/* ------------------------------------------------------------------ */
/* Bulk deliver — one dialog per truck when everything unloads at once  */
/* ------------------------------------------------------------------ */
router.post(
  "/:id/deliver-all",
  can(PERMS.LORRY_RECEIPT.DELIVER),
  async (req, res) => {
    const id = getParamId(req);
    const existing = await db.lRGroup.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        groupNumber: true,
        status: true,
        originBranchId: true,
        destinationBranchId: true,
        lorryReceipts: {
          where: { deletedAt: null },
          select: {
            id: true,
            lrNumber: true,
            status: true,
            createdById: true,
          },
        },
      },
    });
    if (!existing) throw new NotFoundError("Lorry receipt group not found");
    if (existing.status !== "FINALISED") {
      throw new BadRequestError(
        "Only a finalised group can be marked delivered",
      );
    }
    assertBranchAccess(req, existing.destinationBranchId);

    const parsed = deliverGroupSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }
    const input = parsed.data;
    const me = actorId(req);

    const lrById = new Map(existing.lorryReceipts.map((lr) => [lr.id, lr]));
    for (const line of input.lrs) {
      const lr = lrById.get(line.lrId);
      if (!lr) {
        throw new BadRequestError(
          "Every lorry receipt must belong to this group",
        );
      }
      if (lr.status !== "FINALISED") {
        throw new BadRequestError(
          `LR ${lr.lrNumber} is ${lr.status.toLowerCase()} — only FINALISED LRs can be delivered`,
        );
      }
    }

    await db.$transaction(async (tx) => {
      for (const line of input.lrs) {
        await tx.lRDelivery.create({
          data: {
            lrId: line.lrId,
            deliveredAt: input.deliveredAt,
            reportedAt: input.reportedAt ?? null,
            receiverName: input.receiverName ?? null,
            receiverPhone: input.receiverPhone ?? null,
            unloadingCharges:
              line.unloadingCharges ?? input.unloadingCharges ?? null,
            remark: line.remark ?? input.remark ?? null,
            createdById: me,
          },
          select: { id: true },
        });
      }
      await tx.lorryReceipt.updateMany({
        where: { id: { in: input.lrs.map((line) => line.lrId) } },
        data: { status: "DELIVERED", updatedById: me },
      });
      await syncGroupDeliveryStatus(tx, id, me);
    });

    for (const line of input.lrs) {
      const lr = lrById.get(line.lrId)!;
      await publishLRDelivered(
        {
          id: lr.id,
          lrNumber: lr.lrNumber,
          createdById: lr.createdById,
          group: {
            id: existing.id,
            originBranchId: existing.originBranchId,
            destinationBranchId: existing.destinationBranchId,
          },
        },
        me,
      );
    }

    const updated = await db.lRGroup.findUniqueOrThrow({
      where: { id },
      include: groupDetailInclude,
    });
    return sendOk(res, updated);
  },
);

/* ------------------------------------------------------------------ */
/* Add an LR (consignment line) to a DRAFT group                        */
/* ------------------------------------------------------------------ */
router.post(
  "/:id/lorry-receipts",
  can(PERMS.LORRY_RECEIPT.UPDATE),
  async (req, res) => {
    const id = getParamId(req);

    const group = await db.lRGroup.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        status: true,
        fyCode: true,
        originBranchId: true,
        originBranch: { select: { branchCode: true } },
      },
    });

    if (!group) throw new NotFoundError("Lorry receipt group not found");

    if (group.status !== "DRAFT") {
      throw new BadRequestError("LRs can only be added to a DRAFT group");
    }

    assertBranchAccess(req, group.originBranchId);

    const parsed = lrGroupLineSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const line = parsed.data;
    const me = actorId(req);

    await db.$transaction(async (tx) => {
      const lrNumber = await generateLRNumber(
        tx,
        group.originBranch.branchCode,
        group.fyCode,
      );

      await tx.lorryReceipt.create({
        data: {
          lrNumber,
          fyCode: group.fyCode,
          groupId: group.id,
          loadingLocationId: line.loadingLocationId ?? null,
          unloadingLocationId: line.unloadingLocationId ?? null,
          totalWeight: line.totalWeight ?? null,
          unit: line.totalWeightUnit ?? null,
          status: "DRAFT",
          createdById: me,
          goods: (line.goods ?? []).length
            ? {
                create: (line.goods ?? []).map((g) => ({
                  name: g.name,
                  description: g.description ?? null,
                  quantity: g.quantity,
                  length: g.length ?? null,
                  width: g.width ?? null,
                  height: g.height ?? null,
                })),
              }
            : undefined,
        },
      });
    });

    const updated = await db.lRGroup.findUniqueOrThrow({
      where: { id },
      include: groupDetailInclude,
    });

    return sendOk(res, updated, undefined, 201);
  },
);
/* ------------------------------------------------------------------ */
/* Cancel — cancels the group and all its LRs                          */
/* ------------------------------------------------------------------ */
router.post(
  "/:id/cancel",
  can(PERMS.LORRY_RECEIPT.CANCEL),
  async (req, res) => {
    const id = getParamId(req);
    const existing = await db.lRGroup.findFirst({
      where: { id, deletedAt: null },
    });
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
        data: {
          status: "CANCELLED",
          cancelReason: parsed.data.cancelReason,
          updatedById: me,
        },
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
  },
);

export default router;
