import { Router, type Request } from "express";
import { PERMS } from "@skerp/types";
import {
  cancelDeliveryChallanSchema,
  createDeliveryChallanSchema,
  issueDeliveryChallanSchema,
  updateDeliveryChallanSchema,
  type CreateDeliveryChallanInput,
  type UpdateDeliveryChallanInput,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";
import type { Prisma } from "../../../generated/prisma/index.js";
import { assertBranchAccess } from "../../auth/branch-scope.js";
import { can } from "../../auth/can.middleware.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../lib/error.js";
import { rupeesToPaise } from "../../lib/money.js";
import {
  formatDocNumber,
  fyCodeFor,
  nextSequence,
} from "../_shared/doc-number.js";
import { getParamId } from "../_shared/param.js";
import { parseListQuery } from "../_shared/list.query.js";
import { sendOk } from "../_shared/response.js";

const router: Router = Router();
router.use(authMiddleware);

const actorId = (req: Request) => {
  const id = req.user?.userId;
  if (!id) throw new BadRequestError("User context is missing");
  return id;
};
const calculateTransportCharges = (
  freightAmount?: number,
  advanceAmount?: number,
) => {
  if (
    freightAmount !== undefined &&
    (!Number.isFinite(freightAmount) || freightAmount < 0)
  ) {
    throw new BadRequestError("Freight amount must be a non-negative number");
  }

  if (
    advanceAmount !== undefined &&
    (!Number.isFinite(advanceAmount) || advanceAmount < 0)
  ) {
    throw new BadRequestError("Advance amount must be a non-negative number");
  }

  if ((advanceAmount ?? 0) > 0 && freightAmount === undefined) {
    throw new BadRequestError(
      "Freight amount is required when an advance is entered",
    );
  }

  const freightPaise =
    freightAmount === undefined ? null : BigInt(rupeesToPaise(freightAmount));

  const advancePaise =
    advanceAmount === undefined ? null : BigInt(rupeesToPaise(advanceAmount));

  const balancePayable = (freightPaise ?? 0n) - (advancePaise ?? 0n);

  if (balancePayable < 0n) {
    throw new BadRequestError("Advance amount cannot exceed freight amount");
  }

  return {
    freightPaise,
    advancePaise,
    balancePayable,
  };
};
const branchGrnDispatchInclude = {
  railRake: {
    include: {
      fromBranch: {
        select: { id: true, name: true, branchCode: true },
      },
      toBranch: {
        select: { id: true, name: true, branchCode: true },
      },
      vpSchedule: {
        select: {
          id: true,
          scheduleNumber: true,
          scheduleDate: true,
          sourceArea: {
            select: { id: true, name: true },
          },
          destinationArea: {
            select: { id: true, name: true },
          },
        },
      },
    },
  },
  vpWagonLoading: {
    include: {
      mrRrRow: {
        select: {
          id: true,
          vpNo: true,
          rowLabel: true,
          rowNumber: true,
        },
      },
    },
  },
  items: {
    include: {
      deliveryChallanItems: {
        include: {
          deliveryChallan: {
            select: { id: true, status: true },
          },
        },
      },
      vpLoadingGoods: {
        include: {
          grnGoods: {
            include: {
              grn: {
                include: {
                  lorryReceipt: {
                    include: {
                      unloadingLocation: {
                        include: {
                          area: true,
                          city: true,
                        },
                      },
                      group: {
                        include: {
                          consignee: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.RailBranchGRNInclude;

type DispatchBranchGrn = Prisma.RailBranchGRNGetPayload<{
  include: typeof branchGrnDispatchInclude;
}>;
type DispatchItem = DispatchBranchGrn["items"][number];

const activeAllocatedQty = (item: DispatchItem, excludeChallanId?: string) =>
  item.deliveryChallanItems.reduce((total, allocation) => {
    if (allocation.deliveryChallan.status === "CANCELLED") return total;
    if (allocation.deliveryChallan.id === excludeChallanId) return total;
    return total + allocation.quantity;
  }, 0);

/*
 * Lightweight pending-quantity check for the /options/rakes and
 * /options/vps dropdowns. Those only need to know whether a Branch GRN
 * item still has quantity left to dispatch — they don't render LR,
 * consignee, or destination details — so they select a shallow shape
 * instead of the full branchGrnDispatchInclude (which pulls the whole
 * LR -> group -> consignee/unloadingLocation chain per item).
 */
const pendingQtyItemSelect = {
  receivedQty: true,
  damageQty: true,
  deliveryChallanItems: {
    select: {
      quantity: true,
      deliveryChallan: { select: { status: true } },
    },
  },
} satisfies Prisma.RailBranchGRNItemSelect;

type PendingQtyItem = Prisma.RailBranchGRNItemGetPayload<{
  select: typeof pendingQtyItemSelect;
}>;

const computePendingQty = (item: PendingQtyItem) => {
  const dispatchableQty = Math.max(item.receivedQty - item.damageQty, 0);
  const challanedQty = item.deliveryChallanItems.reduce(
    (total, allocation) =>
      allocation.deliveryChallan.status === "CANCELLED"
        ? total
        : total + allocation.quantity,
    0,
  );
  return Math.max(dispatchableQty - challanedQty, 0);
};

const previewItem = (item: DispatchItem, excludeChallanId?: string) => {
  const lr = item.vpLoadingGoods.grnGoods.grn.lorryReceipt;
  const location = lr.unloadingLocation;
  const dispatchableQty = Math.max(item.receivedQty - item.damageQty, 0);
  const challanedQty = activeAllocatedQty(item, excludeChallanId);

  return {
    branchGrnItemId: item.id,
    lrNumber: item.lrNumberSnapshot,
    consigneeId: lr.group.consignee.id,
    consigneeName: item.consigneeNameSnapshot ?? lr.group.consignee.name,
    goodsName: item.goodsNameSnapshot,
    unit: item.unitSnapshot,
    receivedQty: item.receivedQty,
    damageQty: item.damageQty,
    dispatchableQty,
    challanedQty,
    pendingQty: Math.max(dispatchableQty - challanedQty, 0),
    destinationLocationId: location?.id ?? null,
    destinationAreaId: location?.areaId ?? null,
    deliveryAddress:
      location?.address ??
      location?.area?.formattedAddress ??
      location?.area?.name ??
      null,
  };
};

const getDispatchBranchGrn = async (
  client: Prisma.TransactionClient | typeof db,
  branchGrnId: string,
) =>
  client.railBranchGRN.findUnique({
    where: { id: branchGrnId },
    include: branchGrnDispatchInclude,
  });

const validateBranchGrnAccess = (req: Request, grn: DispatchBranchGrn) => {
  assertBranchAccess(req, grn.railRake.toBranchId);
  if (grn.status !== "SUBMITTED") {
    throw new BadRequestError(
      "Only a submitted Branch GRN can be used for a Delivery Challan",
    );
  }
};

type DispatchFields = CreateDeliveryChallanInput | UpdateDeliveryChallanInput;

const validateDispatchResources = async (
  client: Prisma.TransactionClient | typeof db,
  branchId: string,
  input: DispatchFields,
  grn: DispatchBranchGrn,
) => {
  const supervisor = await client.labour.findFirst({
    where: {
      id: input.supervisorId,
      branchId,
      type: "Supervisor",
    },
    select: { id: true },
  });
  if (!supervisor) {
    throw new BadRequestError(
      "Select an unloading Supervisor from the dispatch branch Labour master",
    );
  }

  const destinationLocation = input.destinationLocationId
    ? await client.customerLocation.findUnique({
        where: { id: input.destinationLocationId },
        select: {
          id: true,
          customerId: true,
          address: true,
          areaId: true,
          area: { select: { name: true, formattedAddress: true } },
        },
      })
    : null;
  if (input.destinationLocationId && !destinationLocation) {
    throw new BadRequestError("Selected delivery location was not found");
  }

  const selectedItemIds = new Set(
    input.items.map((item) => item.branchGrnItemId),
  );
  const consigneeIds = new Set(
    grn.items
      .filter((item) => selectedItemIds.has(item.id))
      .map(
        (item) =>
          item.vpLoadingGoods.grnGoods.grn.lorryReceipt.group.consignee.id,
      ),
  );
  if (consigneeIds.size > 1) {
    throw new BadRequestError(
      "Selected goods belong to different consignees. Create a separate Delivery Challan for each consignee.",
    );
  }
  if (
    destinationLocation &&
    !consigneeIds.has(destinationLocation.customerId)
  ) {
    throw new BadRequestError(
      "Delivery destination must belong to the selected consignee",
    );
  }

  if (input.destinationAreaId) {
    const area = await client.area.findUnique({
      where: { id: input.destinationAreaId },
      select: { id: true },
    });
    if (!area) throw new BadRequestError("Selected destination was not found");
  }

  const vehicleInclude = {
    transport: { select: { id: true, name: true } },
    vehicleTypeRef: { select: { name: true } },
  } satisfies Prisma.VehicleInclude;

  const vehicle = input.vehicleId
    ? await client.vehicle.findUnique({
        where: { id: input.vehicleId },
        include: vehicleInclude,
      })
    : null;
  if (input.vehicleId && !vehicle) {
    throw new BadRequestError("Selected vehicle was not found");
  }

  if (input.vehicleMode === "OWN") {
    if (!vehicle || vehicle.ownershipType !== "Own_Vehicle") {
      throw new BadRequestError("Select an own vehicle for own delivery");
    }

    return {
      transportId: null,
      transporterName: null,
      vehicleId: vehicle.id,
      vehicleNumber: vehicle.vehicleNumber,
      vehicleType: vehicle.vehicleTypeRef.name,
      destinationLocation,
    };
  }

  if (!input.transportId) {
    throw new BadRequestError("Transporter is required for market delivery");
  }

  const transport = await client.transport.findUnique({
    where: { id: input.transportId },
    select: { id: true, name: true },
  });
  if (!transport) {
    throw new BadRequestError("Selected transporter was not found");
  }

  const manualVehicleNumber = input.vehicleNumber?.trim().toUpperCase();
  if (!vehicle && !manualVehicleNumber) {
    throw new BadRequestError("Vehicle number is required for market delivery");
  }

  const matchedVehicle =
    vehicle ??
    (manualVehicleNumber
      ? await client.vehicle.findFirst({
          where: {
            vehicleNumber: { equals: manualVehicleNumber, mode: "insensitive" },
          },
          include: vehicleInclude,
        })
      : null);

  if (
    matchedVehicle &&
    (matchedVehicle.ownershipType !== "Market_Vehicle" ||
      matchedVehicle.transportId !== input.transportId)
  ) {
    throw new BadRequestError(
      "Selected market vehicle does not belong to the transporter",
    );
  }

  return {
    transportId: transport.id,
    transporterName: transport.name,
    vehicleId: matchedVehicle?.id ?? null,
    vehicleNumber: matchedVehicle?.vehicleNumber ?? manualVehicleNumber,
    vehicleType: matchedVehicle?.vehicleTypeRef.name ?? null,
    destinationLocation,
  };
};

const buildAllocations = (
  grn: DispatchBranchGrn,
  input: DispatchFields,
  excludeChallanId?: string,
) => {
  const requestedIds = new Set(input.items.map((item) => item.branchGrnItemId));
  if (requestedIds.size !== input.items.length) {
    throw new BadRequestError("Each Branch GRN goods line can be added once");
  }

  const sourceById = new Map(grn.items.map((item) => [item.id, item]));
  return input.items.map((requested) => {
    const source = sourceById.get(requested.branchGrnItemId);
    if (!source) {
      throw new BadRequestError(
        "A selected goods line does not belong to the Branch GRN",
      );
    }

    const itemPreview = previewItem(source, excludeChallanId);
    if (requested.quantity > itemPreview.pendingQty) {
      throw new ConflictError(
        `${source.goodsNameSnapshot}: only ${itemPreview.pendingQty} quantity is pending`,
      );
    }

    return {
      branchGrnItemId: source.id,
      quantity: requested.quantity,
      lrNumberSnapshot: source.lrNumberSnapshot,
      consigneeNameSnapshot: itemPreview.consigneeName,
      goodsNameSnapshot: source.goodsNameSnapshot,
      unitSnapshot: source.unitSnapshot,
      deliveryAddressSnapshot: itemPreview.deliveryAddress,
    };
  });
};

const challanInclude = {
  branchGrn: {
    include: {
      railRake: {
        include: {
          fromBranch: true,
          toBranch: true,
          vpSchedule: {
            include: {
              sourceArea: true,
              destinationArea: true,
            },
          },
        },
      },
      vpWagonLoading: {
        include: { mrRrRow: true },
      },
    },
  },
  sourceBranch: true,
  destinationArea: true,
  destinationLocation: true,
  transport: true,
  vehicle: { include: { vehicleTypeRef: true } },
  supervisor: {
    select: {
      id: true,
      name: true,
      mobileNo: true,
    },
  },
  items: {
    include: { branchGrnItem: true },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.DeliveryChallanInclude;
const withBalancePayable = <
  T extends {
    freightAmount: bigint | null;
    advanceAmount: bigint | null;
  },
>(
  challan: T,
) => ({
  ...challan,
  balancePayable: (challan.freightAmount ?? 0n) - (challan.advanceAmount ?? 0n),
});
router.get(
  "/options/rakes",
  can(PERMS.DELIVERY_CHALLAN.VIEW),
  async (req, res) => {
    const scheduleDate =
      typeof req.query.scheduleDate === "string"
        ? req.query.scheduleDate.trim()
        : "";
    const start = scheduleDate
      ? new Date(`${scheduleDate}T00:00:00.000Z`)
      : null;
    const end = start ? new Date(start.getTime() + 24 * 60 * 60 * 1000) : null;

    const rakes = await db.railRake.findMany({
      where: {
        ...(req.ctx?.branchScope === "ALL"
          ? {}
          : { toBranchId: { in: req.ctx?.branchIds ?? [] } }),
        ...(start && end
          ? {
              vpSchedule: {
                scheduleDate: { gte: start, lt: end },
              },
            }
          : {}),
        branchGrns: { some: { status: "SUBMITTED" } },
      },
      include: {
        fromBranch: {
          select: { id: true, name: true, branchCode: true },
        },
        toBranch: {
          select: { id: true, name: true, branchCode: true },
        },
        vpSchedule: {
          select: {
            scheduleNumber: true,
            scheduleDate: true,
            sourceArea: {
              select: { id: true, name: true },
            },
            destinationArea: {
              select: { id: true, name: true },
            },
          },
        },
        branchGrns: {
          where: { status: "SUBMITTED" },
          select: {
            items: { select: pendingQtyItemSelect },
          },
        },
      },
      orderBy: { vpSchedule: { scheduleDate: "desc" } },
      take: 500,
    });

    const options = rakes
      .map((rake) => {
        const eligibleVpCount = rake.branchGrns.filter((grn) =>
          grn.items.some((item) => computePendingQty(item) > 0),
        ).length;
        return {
          id: rake.id,
          rakeNumber: rake.rakeNumber,
          scheduleDate: rake.vpSchedule.scheduleDate,
          scheduleNumber: rake.vpSchedule.scheduleNumber,
          sourceBranch: rake.fromBranch,
          receivingBranch: rake.toBranch,
          sourceArea: rake.vpSchedule.sourceArea,
          destinationArea: rake.vpSchedule.destinationArea,
          eligibleVpCount,
        };
      })
      .filter((rake) => rake.eligibleVpCount > 0);

    return sendOk(res, options);
  },
);

router.get(
  "/options/vps",
  can(PERMS.DELIVERY_CHALLAN.VIEW),
  async (req, res) => {
    const rakeId =
      typeof req.query.rakeId === "string" ? req.query.rakeId.trim() : "";
    if (!rakeId) throw new BadRequestError("Rake ID is required");

    const rake = await db.railRake.findUnique({
      where: { id: rakeId },
      select: { toBranchId: true },
    });
    if (!rake) throw new NotFoundError("Rail Rake not found");
    assertBranchAccess(req, rake.toBranchId);

    const grns = await db.railBranchGRN.findMany({
      where: { railRakeId: rakeId, status: "SUBMITTED" },
      select: {
        id: true,
        vpWagonLoadingId: true,
        totalReceivedQty: true,
        vpWagonLoading: {
          select: {
            mrRrRow: { select: { vpNo: true, rowLabel: true } },
          },
        },
        items: { select: pendingQtyItemSelect },
      },
      orderBy: {
        vpWagonLoading: { mrRrRow: { rowNumber: "asc" } },
      },
    });

    const options = grns
      .map((grn) => {
        const pendingQty = grn.items.reduce(
          (total, item) => total + computePendingQty(item),
          0,
        );
        return {
          branchGrnId: grn.id,
          vpWagonLoadingId: grn.vpWagonLoadingId,
          vpNo: grn.vpWagonLoading.mrRrRow.vpNo,
          rowLabel: grn.vpWagonLoading.mrRrRow.rowLabel,
          receivedQty: grn.totalReceivedQty,
          pendingQty,
        };
      })
      .filter((grn) => grn.pendingQty > 0);

    return sendOk(res, options);
  },
);

router.get(
  "/options/supervisors",
  can(PERMS.DELIVERY_CHALLAN.VIEW),
  async (req, res) => {
    const branchGrnId =
      typeof req.query.branchGrnId === "string"
        ? req.query.branchGrnId.trim()
        : "";
    if (!branchGrnId) {
      throw new BadRequestError("Branch GRN ID is required");
    }

    const grn = await db.railBranchGRN.findUnique({
      where: { id: branchGrnId },
      select: { status: true, railRake: { select: { toBranchId: true } } },
    });
    if (!grn) throw new NotFoundError("Branch GRN not found");
    assertBranchAccess(req, grn.railRake.toBranchId);

    const supervisors = await db.labour.findMany({
      where: {
        branchId: grn.railRake.toBranchId,
        type: "Supervisor",
      },
      select: {
        id: true,
        name: true,
        mobileNo: true,
      },
      orderBy: { name: "asc" },
      take: 500,
    });

    return sendOk(
      res,
      supervisors.map((labour) => ({
        id: labour.id,
        name: labour.name,
        mobileNo: labour.mobileNo,
      })),
    );
  },
);

router.get(
  "/options/transports",
  can(PERMS.DELIVERY_CHALLAN.VIEW),
  async (_req, res) => {
    const transports = await db.transport.findMany({
      select: { id: true, name: true, phoneNo: true },
      orderBy: { name: "asc" },
      take: 1000,
    });
    return sendOk(res, transports);
  },
);

router.get(
  "/options/vehicles",
  can(PERMS.DELIVERY_CHALLAN.VIEW),
  async (req, res) => {
    const mode =
      typeof req.query.mode === "string" ? req.query.mode.toUpperCase() : "";
    const transportId =
      typeof req.query.transportId === "string"
        ? req.query.transportId.trim()
        : "";

    if (mode !== "OWN" && mode !== "MARKET") {
      throw new BadRequestError("Vehicle mode must be OWN or MARKET");
    }
    if (mode === "MARKET" && !transportId) {
      throw new BadRequestError("Transporter is required for market vehicles");
    }

    const vehicles = await db.vehicle.findMany({
      where: {
        ownershipType: mode === "OWN" ? "Own_Vehicle" : "Market_Vehicle",
        ...(mode === "MARKET" ? { transportId } : {}),
      },
      select: {
        id: true,
        vehicleNumber: true,
        status: true,
        capacityMT: true,
        vehicleTypeRef: { select: { id: true, name: true, code: true } },
      },
      orderBy: { vehicleNumber: "asc" },
      take: 1000,
    });
    return sendOk(res, vehicles);
  },
);

router.get(
  "/preview/:id",
  can(PERMS.DELIVERY_CHALLAN.VIEW),
  async (req, res) => {
    const grn = await getDispatchBranchGrn(db, getParamId(req));
    if (!grn) throw new NotFoundError("Branch GRN not found");
    validateBranchGrnAccess(req, grn);

    const consigneeIds = [
      ...new Set(
        grn.items.map(
          (item) =>
            item.vpLoadingGoods.grnGoods.grn.lorryReceipt.group.consignee.id,
        ),
      ),
    ];
    const destinationOptions = await db.customerLocation.findMany({
      where: { customerId: { in: consigneeIds } },
      select: {
        id: true,
        customerId: true,
        name: true,
        address: true,
        areaId: true,
        area: {
          select: {
            id: true,
            name: true,
            formattedAddress: true,
          },
        },
        city: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ customerId: "asc" }, { name: "asc" }],
    });

    return sendOk(res, {
      branchGrnId: grn.id,
      rake: {
        id: grn.railRake.id,
        rakeNumber: grn.railRake.rakeNumber,
        scheduleNumber: grn.railRake.vpSchedule.scheduleNumber,
        scheduleDate: grn.railRake.vpSchedule.scheduleDate,
      },
      vp: {
        id: grn.vpWagonLoadingId,
        vpNo: grn.vpWagonLoading.mrRrRow.vpNo,
        rowLabel: grn.vpWagonLoading.mrRrRow.rowLabel,
      },
      sourceBranch: grn.railRake.toBranch,
      destinationOptions,
      items: grn.items.map((item) => previewItem(item)),
    });
  },
);

router.get("/", can(PERMS.DELIVERY_CHALLAN.VIEW), async (req, res) => {
  const query = parseListQuery(req);
  const status = query.filter.status?.toUpperCase();
  const where: Prisma.DeliveryChallanWhereInput = {
    ...(req.ctx?.branchScope === "ALL"
      ? {}
      : { sourceBranchId: { in: req.ctx?.branchIds ?? [] } }),
    ...(status
      ? {
          status: status as Prisma.EnumDeliveryChallanStatusFilter["equals"],
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            {
              challanNumber: {
                contains: query.search,
                mode: "insensitive",
              },
            },
            {
              vehicleNumberSnapshot: {
                contains: query.search,
                mode: "insensitive",
              },
            },
            {
              transporterNameSnapshot: {
                contains: query.search,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    db.deliveryChallan.findMany({
      where,
      include: challanInclude,
      skip: query.page * query.size,
      take: query.size,
      orderBy: query.sort
        ? { [query.sort.field]: query.sort.direction }
        : { createdAt: "desc" },
    }),
    db.deliveryChallan.count({ where }),
  ]);

  return sendOk(res, rows.map(withBalancePayable), {
    page: query.page,
    size: query.size,
    total,
  });
});

router.post("/", can(PERMS.DELIVERY_CHALLAN.CREATE), async (req, res) => {
  const parsed = createDeliveryChallanSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }

  const input = parsed.data;
  const userId = actorId(req);

  /*
   * STEP 1:
   * Load and validate normal data outside the transaction.
   */
  const accessible = await getDispatchBranchGrn(db, input.branchGrnId);

  if (!accessible) {
    throw new NotFoundError("Branch GRN not found");
  }

  validateBranchGrnAccess(req, accessible);

  const resources = await validateDispatchResources(
    db,
    accessible.railRake.toBranchId,
    input,
    accessible,
  );

  /*
   * This initial build gives early validation errors.
   * It must still be checked again inside the transaction
   * because another challan may be created concurrently.
   */
  buildAllocations(accessible, input);

  const fyCode = fyCodeFor(input.loadingAt);
  const branchCode = accessible.railRake.toBranch.branchCode;

  /*
   * STEP 2:
   * Keep the transaction short.
   */
  const created = await db.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT "id"
      FROM "RailBranchGRN"
      WHERE "id" = ${input.branchGrnId}
      FOR UPDATE
    `;

    /*
     * Re-fetch only the information required to validate allocation.
     * Avoid loading the complete challan response include here.
     */
    const grn = await getDispatchBranchGrn(tx, input.branchGrnId);

    if (!grn) {
      throw new NotFoundError("Branch GRN not found");
    }

    if (grn.status !== "SUBMITTED") {
      throw new BadRequestError("Branch GRN is not submitted");
    }

    /*
     * Important:
     * Recalculate pending quantities after acquiring the lock.
     */
    const items = buildAllocations(grn, input);
    const charges = calculateTransportCharges(
      input.freightAmount,
      input.advanceAmount,
    );
    const seq = await nextSequence(tx, branchCode, fyCode, "DELIVERY_CHALLAN");

    const createdChallan = await tx.deliveryChallan.create({
      data: {
        challanNumber: formatDocNumber(branchCode, fyCode, seq, "SKDC"),

        fyCode,
        branchGrnId: grn.id,
        sourceBranchId: grn.railRake.toBranchId,

        destinationAreaId:
          input.destinationAreaId ??
          resources.destinationLocation?.areaId ??
          null,

        destinationLocationId: input.destinationLocationId ?? null,

        deliveryAddressSnapshot:
          input.deliveryAddress ??
          resources.destinationLocation?.address ??
          resources.destinationLocation?.area?.formattedAddress ??
          resources.destinationLocation?.area?.name ??
          null,

        vehicleMode: input.vehicleMode,

        transportId: resources.transportId,
        vehicleId: resources.vehicleId,

        transporterNameSnapshot: resources.transporterName,
        vehicleNumberSnapshot: resources.vehicleNumber,
        vehicleTypeSnapshot: resources.vehicleType,

        driverName: input.driverName ?? null,
        driverMobile: input.driverMobile ?? null,

        totalQuantity: items.reduce((total, item) => total + item.quantity, 0),

        totalWeight: input.totalWeight,

        freightAmount: charges.freightPaise,
        advanceAmount: charges.advancePaise,

        paymentBy: input.paymentBy ?? null,
        loadingAt: input.loadingAt,
        supervisorId: input.supervisorId,
        remarks: input.remarks ?? null,
        createdById: userId,

        items: {
          create: items,
        },
      },

      /*
       * Do not use challanInclude inside the transaction, and don't
       * re-fetch the full detail after commit either — every caller of
       * this endpoint only reads `.id` from the response and refetches
       * detail separately via GET /:id when it actually needs it.
       */
      select: {
        id: true,
        status: true,
        version: true,
      },
    });

    return createdChallan;
  });

  return sendOk(res, created, undefined, 201);
});
router.get("/:id", can(PERMS.DELIVERY_CHALLAN.VIEW), async (req, res) => {
  const row = await db.deliveryChallan.findUnique({
    where: { id: getParamId(req) },
    include: challanInclude,
  });
  if (!row) throw new NotFoundError("Delivery Challan not found");
  assertBranchAccess(req, row.sourceBranchId);
  return sendOk(res, withBalancePayable(row));
});
router.patch("/:id", can(PERMS.DELIVERY_CHALLAN.UPDATE), async (req, res) => {
  const parsed = updateDeliveryChallanSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }

  const input = parsed.data;
  const id = getParamId(req);
  const userId = actorId(req);

  /*
   * STEP 1:
   * Load and validate normal data outside the transaction.
   */
  const existing = await db.deliveryChallan.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      version: true,
      branchGrnId: true,
      sourceBranchId: true,
    },
  });

  if (!existing) {
    throw new NotFoundError("Delivery Challan not found");
  }

  assertBranchAccess(req, existing.sourceBranchId);

  if (existing.status !== "DRAFT") {
    throw new BadRequestError("Only a draft Delivery Challan can be edited");
  }

  if (existing.version !== input.version) {
    throw new ConflictError(
      "Delivery Challan changed. Please refresh before saving.",
    );
  }

  const accessible = await getDispatchBranchGrn(db, existing.branchGrnId);

  if (!accessible) {
    throw new NotFoundError("Branch GRN not found");
  }

  validateBranchGrnAccess(req, accessible);

  /*
   * Validate destination, supervisor, transporter and vehicle
   * outside the interactive transaction.
   */
  const resources = await validateDispatchResources(
    db,
    accessible.railRake.toBranchId,
    input,
    accessible,
  );

  /*
   * Initial allocation validation for an early error response.
   * Existing challan quantities are excluded.
   */
  buildAllocations(accessible, input, existing.id);

  const charges = calculateTransportCharges(
    input.freightAmount,
    input.advanceAmount,
  );

  /*
   * STEP 2:
   * Keep the transaction short.
   */
  const updated = await db.$transaction(async (tx) => {
    /*
     * Use the same lock order as the Issue API:
     * 1. RailBranchGRN
     * 2. DeliveryChallan
     */
    await tx.$queryRaw`
          SELECT "id"
          FROM "RailBranchGRN"
          WHERE "id" = ${existing.branchGrnId}
          FOR UPDATE
        `;

    await tx.$queryRaw`
          SELECT "id"
          FROM "DeliveryChallan"
          WHERE "id" = ${existing.id}
          FOR UPDATE
        `;

    /*
     * Recheck the challan after obtaining the lock.
     */
    const current = await tx.deliveryChallan.findUnique({
      where: {
        id: existing.id,
      },
      select: {
        id: true,
        status: true,
        version: true,
        branchGrnId: true,
      },
    });

    if (!current) {
      throw new NotFoundError("Delivery Challan not found");
    }

    if (current.status !== "DRAFT") {
      throw new BadRequestError("Only a draft Delivery Challan can be edited");
    }

    if (current.version !== input.version) {
      throw new ConflictError(
        "Delivery Challan changed. Please refresh before saving.",
      );
    }

    if (current.branchGrnId !== existing.branchGrnId) {
      throw new ConflictError("Delivery Challan Branch GRN has changed");
    }

    /*
     * Reload after locking so pending quantities are current.
     */
    const grn = await getDispatchBranchGrn(tx, current.branchGrnId);

    if (!grn) {
      throw new NotFoundError("Branch GRN not found");
    }

    if (grn.status !== "SUBMITTED") {
      throw new BadRequestError("Branch GRN is not submitted");
    }

    /*
     * Recalculate allocations after acquiring the lock.
     * Exclude this challan's existing allocations.
     */
    const items = buildAllocations(grn, input, current.id);

    /*
     * Delete existing allocations explicitly.
     * This prevents the composite unique constraint error.
     */
    await tx.deliveryChallanItem.deleteMany({
      where: {
        deliveryChallanId: current.id,
      },
    });

    const updatedChallan = await tx.deliveryChallan.update({
      where: {
        id: current.id,
        version: current.version,
      },
      data: {
        destinationAreaId:
          input.destinationAreaId ??
          resources.destinationLocation?.areaId ??
          null,

        destinationLocationId: input.destinationLocationId ?? null,

        deliveryAddressSnapshot:
          input.deliveryAddress ??
          resources.destinationLocation?.address ??
          resources.destinationLocation?.area?.formattedAddress ??
          resources.destinationLocation?.area?.name ??
          null,

        vehicleMode: input.vehicleMode,

        transportId: resources.transportId,
        vehicleId: resources.vehicleId,

        transporterNameSnapshot: resources.transporterName,

        vehicleNumberSnapshot: resources.vehicleNumber,

        vehicleTypeSnapshot: resources.vehicleType,

        driverName: input.driverName ?? null,

        driverMobile: input.driverMobile ?? null,

        totalQuantity: items.reduce((total, item) => total + item.quantity, 0),

        totalWeight: input.totalWeight ?? null,

        freightAmount: charges.freightPaise,

        advanceAmount: charges.advancePaise,

        paymentBy: input.paymentBy ?? null,

        loadingAt: input.loadingAt,
        supervisorId: input.supervisorId,
        remarks: input.remarks ?? null,

        updatedById: userId,
        version: {
          increment: 1,
        },

        items: {
          create: items,
        },
      },

      /*
       * Don't load challanInclude here, and don't re-fetch full detail
       * after commit either — the caller only reads `.id` from the
       * response and refetches detail separately via GET /:id.
       */
      select: {
        id: true,
        status: true,
        version: true,
      },
    });

    return updatedChallan;
  });

  return sendOk(res, updated);
});
router.post(
  "/:id/issue",
  can(PERMS.DELIVERY_CHALLAN.ISSUE),
  async (req, res) => {
    const parsed = issueDeliveryChallanSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const id = getParamId(req);
    const userId = actorId(req);

    // Lightweight lookup before starting the transaction
    const existing = await db.deliveryChallan.findUnique({
      where: { id },
      select: {
        id: true,
        branchGrnId: true,
        sourceBranchId: true,
      },
    });

    if (!existing) {
      throw new NotFoundError("Delivery Challan not found");
    }

    assertBranchAccess(req, existing.sourceBranchId);

    const issued = await db.$transaction(async (tx) => {
      // Lock the shared Branch GRN first.
      // Create/update routes should use the same lock order.
      await tx.$queryRaw`
        SELECT "id"
        FROM "RailBranchGRN"
        WHERE "id" = ${existing.branchGrnId}
        FOR UPDATE
      `;

      await tx.$queryRaw`
        SELECT "id"
        FROM "DeliveryChallan"
        WHERE "id" = ${existing.id}
        FOR UPDATE
      `;

      // Load only the fields required for issuing
      const challan = await tx.deliveryChallan.findUnique({
        where: { id: existing.id },
        select: {
          id: true,
          branchGrnId: true,
          sourceBranchId: true,
          status: true,
          version: true,
          items: {
            select: {
              branchGrnItemId: true,
              quantity: true,
            },
          },
        },
      });

      if (!challan) {
        throw new NotFoundError("Delivery Challan not found");
      }

      assertBranchAccess(req, challan.sourceBranchId);

      if (challan.status !== "DRAFT") {
        throw new BadRequestError(
          "Only a draft Delivery Challan can be issued",
        );
      }

      if (challan.version !== parsed.data.version) {
        throw new ConflictError(
          "Delivery Challan changed. Please refresh before issuing.",
        );
      }

      if (!challan.items.length) {
        throw new BadRequestError("Delivery Challan has no goods lines");
      }

      const sourceItemIds = challan.items.map((item) => item.branchGrnItemId);

      // Load only quantity information needed for validation
      const branchGrn = await tx.railBranchGRN.findUnique({
        where: { id: challan.branchGrnId },
        select: {
          items: {
            where: {
              id: { in: sourceItemIds },
            },
            select: {
              id: true,
              receivedQty: true,
              damageQty: true,
              goodsNameSnapshot: true,
              deliveryChallanItems: {
                where: {
                  deliveryChallan: {
                    is: {
                      id: { not: challan.id },
                      status: { not: "CANCELLED" },
                    },
                  },
                },
                select: {
                  quantity: true,
                },
              },
            },
          },
        },
      });

      if (!branchGrn) {
        throw new ConflictError("Branch GRN no longer exists");
      }

      const sourceItemsById = new Map(
        branchGrn.items.map((item) => [item.id, item]),
      );

      for (const allocation of challan.items) {
        const source = sourceItemsById.get(allocation.branchGrnItemId);

        if (!source) {
          throw new ConflictError("Branch GRN goods line changed");
        }

        const dispatchableQty = Math.max(
          source.receivedQty - source.damageQty,
          0,
        );

        const allocatedToOtherChallans = source.deliveryChallanItems.reduce(
          (total, item) => total + item.quantity,
          0,
        );

        const pendingWithoutCurrent = Math.max(
          dispatchableQty - allocatedToOtherChallans,
          0,
        );

        if (allocation.quantity > pendingWithoutCurrent) {
          throw new ConflictError(
            `${source.goodsNameSnapshot}: pending quantity is no longer sufficient`,
          );
        }
      }

      // Update only; don't load the complete relation tree here, and don't
      // re-fetch it after commit either — the caller only reads `.id`.
      const updatedChallan = await tx.deliveryChallan.update({
        where: {
          id: challan.id,
          version: challan.version,
        },
        data: {
          status: "ISSUED",
          issuedAt: new Date(),
          issuedById: userId,
          updatedById: userId,
          version: { increment: 1 },
        },
        select: {
          id: true,
          status: true,
          version: true,
        },
      });

      return updatedChallan;
    });

    return sendOk(res, issued);
  },
);
router.post(
  "/:id/cancel",
  can(PERMS.DELIVERY_CHALLAN.CANCEL),
  async (req, res) => {
    const parsed = cancelDeliveryChallanSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }
    const id = getParamId(req);
    const existing = await db.deliveryChallan.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        version: true,
        sourceBranchId: true,
      },
    });
    if (!existing) throw new NotFoundError("Delivery Challan not found");
    assertBranchAccess(req, existing.sourceBranchId);
    if (existing.status === "CANCELLED") {
      return sendOk(res, {
        id: existing.id,
        status: existing.status,
        version: existing.version,
      });
    }
    if (existing.version !== parsed.data.version) {
      throw new ConflictError(
        "Delivery Challan changed. Please refresh before cancelling.",
      );
    }

    // Don't load challanInclude here — the caller only reads `.id`.
    const cancelled = await db.deliveryChallan.update({
      where: { id: existing.id, version: existing.version },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledById: actorId(req),
        cancelReason: parsed.data.reason,
        updatedById: actorId(req),
        version: { increment: 1 },
      },
      select: {
        id: true,
        status: true,
        version: true,
      },
    });
    return sendOk(res, cancelled);
  },
);

router.delete("/:id", can(PERMS.DELIVERY_CHALLAN.DELETE), async (req, res) => {
  const id = getParamId(req);
  const existing = await db.deliveryChallan.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Delivery Challan not found");
  assertBranchAccess(req, existing.sourceBranchId);
  if (existing.status !== "DRAFT") {
    throw new BadRequestError("Only a draft Delivery Challan can be deleted");
  }
  await db.deliveryChallan.delete({ where: { id: existing.id } });
  return sendOk(res, { id: existing.id, deleted: true });
});

export default router;
