import { Prisma } from "../../../generated/prisma/index.js";
import { rupeesToPaise } from "../../lib/money.js";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../lib/error.js";
import {
  formatDocNumber,
  fyCodeFor,
  nextSequence,
} from "../_shared/doc-number.js";
import type { VPLoadingGoodsInput } from "@skerp/validators";

type Tx = Prisma.TransactionClient;

export const branchSelect = {
  id: true,
  name: true,
  branchCode: true,
} satisfies Prisma.BranchSelect;

export const areaSelect = {
  id: true,
  name: true,
  city: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.AreaSelect;

export const customerSelect = {
  id: true,
  name: true,
} satisfies Prisma.CustomerSelect;

export const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  userName: true,
} satisfies Prisma.UserSelect;

export const labourSelect = {
  id: true,
  name: true,
  mobileNo: true,
  type: true,
} satisfies Prisma.LabourSelect;

export const scheduleHeaderSelect = {
  id: true,
  scheduleNumber: true,
  scheduleDate: true,
  scheduleName: true,
  status: true,
  fromBranchId: true,
  toBranchId: true,
  sourceAreaId: true,
  destinationAreaId: true,
  fromBranch: { select: branchSelect },
  toBranch: { select: branchSelect },
  sourceArea: { select: areaSelect },
  destinationArea: { select: areaSelect },
} satisfies Prisma.VPScheduleSelect;

export const vpWagonLoadingInclude = {
  labour: { select: labourSelect },
  loadingSupervisor: { select: labourSelect },
  createdBy: { select: userSelect },
  updatedBy: { select: userSelect },
  verifiedBy: { select: userSelect },
  cancelledBy: { select: userSelect },
  mrRrRow: {
    include: {
      wagon: true,
      mrRr: {
        include: {
          vpSchedule: {
            select: scheduleHeaderSelect,
          },
        },
      },
    },
  },
  allocations: {
    orderBy: { createdAt: "desc" },
    include: {
      grn: {
        include: {
          lorryReceipt: {
            select: {
              id: true,
              lrNumber: true,
              status: true,
              createdAt: true,
              invoiceNumber: true,
              invoiceAmount: true,
              totalWeight: true,
              unit: true,
              weightUnit: true,
              unloadingLocation: {
                select: {
                  id: true,
                  name: true,
                  address: true,
                  city: { select: { id: true, name: true } },
                },
              },
              group: {
                select: {
                  id: true,
                  groupNumber: true,
                  transportType: true,
                  consignor: { select: customerSelect },
                  consignee: { select: customerSelect },
                  originBranch: { select: branchSelect },
                  destinationBranch: { select: branchSelect },
                },
              },
            },
          },
        },
      },
      goods: {
        include: {
          grnGoods: {
            include: {
              quantityUnit: true,
              weightUnit: true,
            },
          },
        },
      },
      createdBy: { select: userSelect },
      updatedBy: { select: userSelect },
      cancelledBy: { select: userSelect },
    },
  },
} satisfies Prisma.VPWagonLoadingInclude;

export const allocationInclude = {
  vpWagonLoading: {
    include: {
      mrRrRow: {
        include: {
          wagon: true,
          mrRr: {
            include: {
              vpSchedule: {
                select: scheduleHeaderSelect,
              },
            },
          },
        },
      },
    },
  },
  grn: {
    include: {
      lorryReceipt: {
        select: {
          id: true,
          lrNumber: true,
          status: true,
          createdAt: true,
          invoiceNumber: true,
          invoiceAmount: true,
          totalWeight: true,
          unit: true,
          weightUnit: true,
          unloadingLocation: {
            select: {
              id: true,
              name: true,
              address: true,
              city: { select: { id: true, name: true } },
            },
          },
          group: {
            select: {
              id: true,
              groupNumber: true,
              transportType: true,
              consignor: { select: customerSelect },
              consignee: { select: customerSelect },
              originBranch: { select: branchSelect },
              destinationBranch: { select: branchSelect },
            },
          },
        },
      },
    },
  },
  goods: {
    include: {
      grnGoods: {
        include: {
          quantityUnit: true,
          weightUnit: true,
        },
      },
    },
  },
  createdBy: { select: userSelect },
  updatedBy: { select: userSelect },
  cancelledBy: { select: userSelect },
} satisfies Prisma.VPLoadingInclude;

export const toDecimalOrNull = (value: number | null | undefined) =>
  value === undefined || value === null ? null : new Prisma.Decimal(value);

export const decimalToNumber = (
  value: Prisma.Decimal | number | null | undefined,
) => (value === null || value === undefined ? 0 : Number(value));

export const toMoney = (value: number | undefined) =>
  value === undefined ? undefined : BigInt(rupeesToPaise(value));

export const isVPWagonLoadingOpen = (loading?: { status: string } | null) =>
  !loading || ["DRAFT", "IN_PROGRESS"].includes(loading.status);

export const getMRRRRowForLoading = async (
  tx: Tx,
  mrrrRowId: string,
  options: { allowCompleted?: boolean } = {},
) => {
  const row = await tx.mRRRRow.findUnique({
    where: { id: mrrrRowId },
    include: {
      wagon: true,
      vpWagonLoading: true,
      mrRr: {
        include: {
          vpSchedule: {
            select: scheduleHeaderSelect,
          },
        },
      },
    },
  });

  if (!row || row.mrRr.deletedAt) {
    throw new NotFoundError("MR/RR row not found");
  }
  if (row.mrRr.status !== "SUBMITTED") {
    throw new BadRequestError("Only submitted MR/RR rows can be loaded");
  }
  if (
    !["MRRR_CREATED", "LOADING", "LOADED"].includes(row.mrRr.vpSchedule.status)
  ) {
    throw new BadRequestError("VP Schedule is not ready for loading");
  }
  if (!row.vpNo?.trim()) {
    throw new BadRequestError("MR/RR row does not have VP No");
  }
  const canUseRow =
    isVPWagonLoadingOpen(row.vpWagonLoading) ||
    (options.allowCompleted && row.vpWagonLoading?.status === "COMPLETED");

  if (!canUseRow) {
    throw new BadRequestError(
      "This VP wagon loading is already closed and cannot be reused",
    );
  }

  return row;
};

export const assertGRNCompatibleWithRow = (
  row: Awaited<ReturnType<typeof getMRRRRowForLoading>>,
  grn: {
    status: string;
    deletedAt?: Date | null;
    gateNo?: string | null;
    lorryReceipt: {
      status: string;
      group: {
        transportType: string;
        originBranchId: string;
        destinationBranchId: string;
        railheadBranchId: string | null;
        sourceRailheadAreaId: string | null;
        destinationRailheadAreaId: string | null;
      };
    };
  },
) => {
  if (grn.deletedAt) throw new BadRequestError("GRN is deleted");
  if (grn.status !== "SUBMITTED") {
    throw new BadRequestError("Only submitted GRN can be loaded");
  }
  if (!grn.gateNo?.trim()) {
    throw new BadRequestError("GRN gate number is required");
  }
  const grnGateNo = grn.gateNo.trim();

  const lockedGateNo = row.vpWagonLoading?.gateNo?.trim();

  if (lockedGateNo && lockedGateNo !== grnGateNo) {
    throw new BadRequestError(
      `This wagon is assigned to Gate ${lockedGateNo}. GRN from Gate ${grnGateNo} cannot be loaded`,
    );
  }
  if (["CANCELLED", "DRAFT"].includes(grn.lorryReceipt.status)) {
    throw new BadRequestError("LR is not eligible for VP loading");
  }
  if (grn.lorryReceipt.group.transportType !== "RoadAndRail") {
    throw new BadRequestError("Only RoadAndRail LR can be loaded in VP");
  }

  const schedule = row.mrRr.vpSchedule;
  const group = grn.lorryReceipt.group;

  if (group.railheadBranchId !== schedule.fromBranchId) {
    throw new BadRequestError(
      "GRN/LR railhead does not match VP Schedule source branch",
    );
  }

  if (group.destinationBranchId !== schedule.toBranchId) {
    throw new BadRequestError(
      "GRN/LR destination does not match VP Schedule destination",
    );
  }
  if (
    group.sourceRailheadAreaId &&
    group.sourceRailheadAreaId !== schedule.sourceAreaId
  ) {
    throw new BadRequestError(
      "GRN/LR source railhead does not match VP Schedule source railhead",
    );
  }
  if (
    group.destinationRailheadAreaId &&
    group.destinationRailheadAreaId !== schedule.destinationAreaId
  ) {
    throw new BadRequestError(
      "GRN/LR destination railhead does not match VP Schedule destination railhead",
    );
  }
};

export const getGRNForLoading = async (tx: Tx, grnId: string) => {
  const grn = await tx.gRN.findUnique({
    where: { id: grnId },
    include: {
      lorryReceipt: {
        select: {
          id: true,
          lrNumber: true,
          status: true,
          createdAt: true,
          invoiceNumber: true,
          invoiceAmount: true,
          totalWeight: true,
          unit: true,
          weightUnit: true,
          unloadingLocation: {
            select: {
              id: true,
              name: true,
              address: true,
              city: { select: { id: true, name: true } },
            },
          },
          group: {
            select: {
              id: true,
              groupNumber: true,
              transportType: true,
              originBranchId: true,
              destinationBranchId: true,
              railheadBranchId: true,
              sourceRailheadAreaId: true,
              destinationRailheadAreaId: true,
              consignor: { select: customerSelect },
              consignee: { select: customerSelect },
              originBranch: { select: branchSelect },
              destinationBranch: { select: branchSelect },
            },
          },
        },
      },
      goods: {
        orderBy: { createdAt: "asc" },
        include: {
          quantityUnit: true,
          weightUnit: true,
          lrGoods: true,
          vpLoadingGoods: {
            where: {
              vpLoading: {
                status: { not: "CANCELLED" },
              },
            },
            select: {
              loadedQty: true,
              loadingDamageQty: true,
              loadedCft: true,
              loadedWeightMt: true,
              vpLoadingId: true,
            },
          },
        },
      },
    },
  });

  if (!grn) throw new NotFoundError("GRN not found");
  return grn;
};

type AvailabilityGoodsBase = {
  id: string;
  receivedQty: number;
  vpLoadingGoods?: Array<{ loadedQty: number; vpLoadingId?: string }>;
};

export const withAvailability = <
  T extends {
    goods: AvailabilityGoodsBase[];
  },
>(
  grn: T,
  excludeAllocationId?: string,
) => {
  const goods = grn.goods.map((row) => {
    const allocatedQty =
      row.vpLoadingGoods
        ?.filter((item) => item.vpLoadingId !== excludeAllocationId)
        .reduce((sum, item) => sum + item.loadedQty, 0) ?? 0;

    return {
      ...row,
      allocatedQty,
      availableQty: Math.max(row.receivedQty - allocatedQty, 0),
      fullyLoaded: row.receivedQty - allocatedQty <= 0,
    };
  });

  return {
    ...grn,
    goods,
    totalReceivedQty: goods.reduce((sum, row) => sum + row.receivedQty, 0),
    allocatedQty: goods.reduce((sum, row) => sum + row.allocatedQty, 0),
    availableQty: goods.reduce((sum, row) => sum + row.availableQty, 0),
    fullyLoaded: goods.every((row) => row.fullyLoaded),
  } as Omit<T, "goods"> & {
    goods: Array<
      T["goods"][number] & {
        allocatedQty: number;
        availableQty: number;
        fullyLoaded: boolean;
      }
    >;
    totalReceivedQty: number;
    allocatedQty: number;
    availableQty: number;
    fullyLoaded: boolean;
  };
};

export const getEligibleGRNsForRow = async (
  tx: Tx,
  row: Awaited<ReturnType<typeof getMRRRRowForLoading>>,
) => {
  const schedule = row.mrRr.vpSchedule;
  const grns = await tx.gRN.findMany({
    where: {
      deletedAt: null,
      status: "SUBMITTED",
      gateNo: { not: "" },
      lorryReceipt: {
        deletedAt: null,
        status: { not: "CANCELLED" },
        group: {
          transportType: "RoadAndRail",
          railheadBranchId: schedule.fromBranchId,
          destinationBranchId: schedule.toBranchId,
          AND: [
            {
              OR: [
                { sourceRailheadAreaId: schedule.sourceAreaId },
                { sourceRailheadAreaId: null },
              ],
            },
            {
              OR: [
                { destinationRailheadAreaId: schedule.destinationAreaId },
                { destinationRailheadAreaId: null },
              ],
            },
          ],
        },
      },
    },
    include: {
      lorryReceipt: {
        select: {
          id: true,
          lrNumber: true,
          status: true,
          createdAt: true,
          invoiceNumber: true,
          invoiceAmount: true,
          totalWeight: true,
          unit: true,
          weightUnit: true,
          unloadingLocation: {
            select: {
              id: true,
              name: true,
              address: true,
              city: { select: { id: true, name: true } },
            },
          },
          group: {
            select: {
              id: true,
              groupNumber: true,
              transportType: true,
              railheadBranchId: true,
              sourceRailheadAreaId: true,
              destinationRailheadAreaId: true,
              consignor: { select: customerSelect },
              consignee: { select: customerSelect },
              originBranch: { select: branchSelect },
              destinationBranch: { select: branchSelect },
            },
          },
        },
      },
      goods: {
        include: {
          vpLoadingGoods: {
            where: {
              vpLoading: {
                status: { not: "CANCELLED" },
              },
            },
            select: {
              loadedQty: true,
              vpLoadingId: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return grns
    .map((grn) => withAvailability(grn))
    .filter((grn) => grn.availableQty > 0);
};
export const createOrGetVPWagonLoading = async (
  tx: Tx,
  data: {
    mrrrRowId: string;
    actorId: string;

    // Gate comes from the selected GRN, so it is required.
    gateNo: string;

    labourId?: string;
    labourCharge?: number;
    loadingSupervisorId?: string;
    remarks?: string;
    version?: number;
  },
) => {
  const row = await getMRRRRowForLoading(tx, data.mrrrRowId);

  const requestedGateNo = data.gateNo.trim();

  if (!requestedGateNo) {
    throw new BadRequestError("GRN gate number is required");
  }

  /*
   * CASE 1:
   * Wagon loading already exists.
   */
  if (row.vpWagonLoading) {
    const existingWagon = row.vpWagonLoading;

    /*
     * Completed, verified or cancelled wagons
     * cannot receive another LR.
     */
    if (!["DRAFT", "IN_PROGRESS"].includes(existingWagon.status)) {
      throw new BadRequestError(
        "Only a draft or in-progress wagon can be loaded",
      );
    }

    /*
     * Prevent saving stale frontend data.
     */
    if (data.version !== undefined && data.version !== existingWagon.version) {
      throw new ConflictError("Wagon loading was updated by someone else");
    }

    const lockedGateNo = existingWagon.gateNo?.trim();

    /*
     * Once the first LR is added, the wagon gate
     * remains locked until every LR is cancelled.
     */
    if (lockedGateNo && lockedGateNo !== requestedGateNo) {
      throw new BadRequestError(
        `This wagon is assigned to Gate ${lockedGateNo}. LR from Gate ${requestedGateNo} cannot be loaded`,
      );
    }

    /*
     * Update the existing wagon loading.
     *
     * If gateNo was released after cancelling every LR,
     * requestedGateNo assigns the wagon to a new gate.
     */
    return tx.vPWagonLoading.update({
      where: {
        id: existingWagon.id,
      },
      data: {
        status: "IN_PROGRESS",

        gateNo: lockedGateNo ?? requestedGateNo,

        labourId: existingWagon.labourId,
        labourCharge: existingWagon.labourCharge,
        loadingSupervisorId: existingWagon.loadingSupervisorId,

        remarks: data.remarks ?? existingWagon.remarks,

        loadingStartedAt: existingWagon.loadingStartedAt ?? new Date(),

        updatedById: data.actorId,

        version: {
          increment: 1,
        },
      },
      include: vpWagonLoadingInclude,
    });
  }

  /*
   * CASE 2:
   * This is the first LR being added to the wagon.
   * Update the schedule status to LOADING.
   */
  await tx.vPSchedule.update({
    where: {
      id: row.mrRr.vpSchedule.id,
    },
    data: {
      status: "LOADING",
      updatedById: data.actorId,
      version: {
        increment: 1,
      },
    },
  });

  /*
   * Automatically create the wagon loading.
   * No separate Start Wagon API is required.
   */
  return tx.vPWagonLoading.create({
    data: {
      mrRrRowId: row.id,
      status: "IN_PROGRESS",

      // First LR locks the wagon to its GRN gate.
      gateNo: requestedGateNo,

      labourId: data.labourId,
      labourCharge: toMoney(data.labourCharge),
      loadingSupervisorId: data.loadingSupervisorId,
      remarks: data.remarks,

      loadingStartedAt: new Date(),

      wagonCapacityCftSnapshot: toDecimalOrNull(row.wagon.totalCft),

      wagonCapacityMtSnapshot: toDecimalOrNull(row.wagon.capacityMt),

      createdById: data.actorId,
    },
    include: vpWagonLoadingInclude,
  });
};

export const generateVPLoadingNumber = async (tx: Tx, branchCode: string) => {
  const fyCode = fyCodeFor(new Date());
  const seq = await nextSequence(tx, branchCode, fyCode, "VPL");

  return formatDocNumber(branchCode, fyCode, seq, "VPL");
};
export const buildAllocationGoods = (
  grn: {
    goods: Array<
      AvailabilityGoodsBase & {
        goodsName: string;
        availableQty: number;
      }
    >;
  },
  goodsInput: VPLoadingGoodsInput[],
) => {
  const grnGoodsById = new Map(grn.goods.map((row) => [row.id, row]));

  const goodsIds = goodsInput.map((row) => row.grnGoodsId);

  if (new Set(goodsIds).size !== goodsIds.length) {
    throw new BadRequestError(
      "The same GRN goods row cannot be added more than once",
    );
  }

  const rows = goodsInput.map((input) => {
    const grnGoods = grnGoodsById.get(input.grnGoodsId);

    if (!grnGoods) {
      throw new BadRequestError("Selected goods row does not belong to GRN");
    }

    if (input.loadedQty > grnGoods.availableQty) {
      throw new ConflictError(
        `Loaded quantity exceeds available quantity for ${grnGoods.goodsName}`,
      );
    }

    if (input.loadingDamageQty > input.loadedQty) {
      throw new BadRequestError(
        `Damage quantity cannot exceed loaded quantity for ${grnGoods.goodsName}`,
      );
    }

    return {
      grnGoodsId: input.grnGoodsId,
      loadedQty: input.loadedQty,
      loadingDamageQty: input.loadingDamageQty,
      remarks: null,

      unitWeightKgSnapshot: null,
      unitCftSnapshot: null,
      loadedWeightMt: null,
      loadedCft: null,
      measurementSource: "UNKNOWN" as const,
    };
  });

  const totals = {
    loadedQty: rows.reduce((sum, row) => sum + row.loadedQty, 0),
  };

  return {
    rows,
    totals,
  };
};
export const mergeVPLoadingGoods = (
  existingGoods: Array<{
    grnGoodsId: string;
    loadedQty: number;
    loadingDamageQty: number;
  }>,
  inputGoods: VPLoadingGoodsInput[],
): VPLoadingGoodsInput[] => {
  const mergedGoods = new Map<string, VPLoadingGoodsInput>();

  for (const goods of existingGoods) {
    mergedGoods.set(goods.grnGoodsId, {
      grnGoodsId: goods.grnGoodsId,
      loadedQty: Number(goods.loadedQty ?? 0),
      loadingDamageQty: Number(goods.loadingDamageQty ?? 0),
    });
  }

  for (const goods of inputGoods) {
    const current = mergedGoods.get(goods.grnGoodsId) ?? {
      grnGoodsId: goods.grnGoodsId,
      loadedQty: 0,
      loadingDamageQty: 0,
    };

    mergedGoods.set(goods.grnGoodsId, {
      grnGoodsId: goods.grnGoodsId,

      loadedQty: current.loadedQty + goods.loadedQty,

      loadingDamageQty: current.loadingDamageQty + goods.loadingDamageQty,
    });
  }

  return [...mergedGoods.values()];
};
export const getCurrentGRNAvailability = async (tx: Tx, grnId: string) => {
  const grn = await tx.gRN.findUnique({
    where: {
      id: grnId,
    },
    select: {
      id: true,
      status: true,
      deletedAt: true,
      gateNo: true,

      lorryReceipt: {
        select: {
          status: true,

          group: {
            select: {
              transportType: true,
              originBranchId: true,
              destinationBranchId: true,
              railheadBranchId: true,
              sourceRailheadAreaId: true,
              destinationRailheadAreaId: true,
            },
          },
        },
      },

      goods: {
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          goodsName: true,
          receivedQty: true,

          vpLoadingGoods: {
            where: {
              vpLoading: {
                status: {
                  not: "CANCELLED",
                },
              },
            },
            select: {
              vpLoadingId: true,
              loadedQty: true,
            },
          },
        },
      },
    },
  });

  if (!grn) {
    throw new NotFoundError("GRN not found");
  }

  return grn;
};
export const recalculateVPWagonLoadingTotals = async (
  tx: Tx,
  vpWagonLoadingId: string,
  options: {
    detail?: boolean;
  } = {},
) => {
  const totals = await tx.vPLoading.aggregate({
    where: {
      vpWagonLoadingId,
      status: {
        not: "CANCELLED",
      },
    },
    _sum: {
      loadedQty: true,
    },
  });

  const totalLoadedQty = totals._sum.loadedQty ?? 0;

  const updateArgs = {
    where: {
      id: vpWagonLoadingId,
    },
    data: {
      totalLoadedQty,

      // Paper-based VP Loading does not calculate capacity.
      totalLoadedCft: null,
      totalLoadedWeightMt: null,
      capacityCheckStatus: "NOT_CHECKED",
      capacityExceededCft: null,
      capacityExceededMt: null,

      version: {
        increment: 1,
      },
    },
  } satisfies Prisma.VPWagonLoadingUpdateArgs;

  if (options.detail === false) {
    return tx.vPWagonLoading.update(updateArgs);
  }

  return tx.vPWagonLoading.update({
    ...updateArgs,
    include: vpWagonLoadingInclude,
  });
};

export const recalculateVpScheduleLoadingStatus = async (
  tx: Tx,
  vpScheduleId: string,
  actorId?: string,
) => {
  const schedule = await tx.vPSchedule.findUnique({
    where: {
      id: vpScheduleId,
    },
    select: {
      id: true,
      status: true,

      mrRr: {
        select: {
          status: true,

          rows: {
            select: {
              vpNo: true,

              vpWagonLoading: {
                select: {
                  status: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!schedule?.mrRr || schedule.mrRr.status !== "SUBMITTED") {
    return null;
  }

  if (schedule.status === "FINALISED") {
    return schedule;
  }

  const requiredRows = schedule.mrRr.rows;
  const allRequiredRowsHaveVpNumber =
    requiredRows.length > 0 &&
    requiredRows.every((row) => Boolean(row.vpNo?.trim()));

  const activeLoadings = requiredRows
    .map((row) => row.vpWagonLoading)
    .filter(
      (loading): loading is NonNullable<typeof loading> =>
        loading != null && loading.status !== "CANCELLED",
    );

  let nextStatus: "MRRR_CREATED" | "LOADING" | "LOADED" | "VERIFIED" =
    "MRRR_CREATED";

  if (activeLoadings.length > 0) {
    nextStatus = "LOADING";
  }

  const allRequiredRowsHaveLoading =
    allRequiredRowsHaveVpNumber &&
    activeLoadings.length === requiredRows.length;

  if (
    allRequiredRowsHaveLoading &&
    activeLoadings.every((loading) =>
      ["COMPLETED", "VERIFIED"].includes(loading.status),
    )
  ) {
    nextStatus = "LOADED";
  }

  if (
    allRequiredRowsHaveLoading &&
    activeLoadings.every((loading) => loading.status === "VERIFIED")
  ) {
    nextStatus = "VERIFIED";
  }

  if (schedule.status === nextStatus) {
    return schedule;
  }

  return tx.vPSchedule.update({
    where: {
      id: vpScheduleId,
    },
    data: {
      status: nextStatus,
      ...(actorId
        ? {
            updatedById: actorId,
          }
        : {}),
      version: {
        increment: 1,
      },
    },
    select: {
      id: true,
      status: true,
      version: true,
    },
  });
};
export const cancelVPLoadingAllocation = async (
  tx: Tx,
  data: {
    allocationId: string;
    actorId: string;
    version?: number;
    reason: string;
  },
) => {
  const existing = await tx.vPLoading.findUnique({
    where: {
      id: data.allocationId,
    },
    include: allocationInclude,
  });

  if (!existing) {
    throw new NotFoundError("VP loading allocation not found");
  }

  if (existing.status === "CANCELLED") {
    throw new BadRequestError("Allocation is already cancelled");
  }

  if (existing.status !== "LOADED") {
    throw new BadRequestError("Only a loaded allocation can be cancelled");
  }

  if (existing.vpWagonLoading.status !== "IN_PROGRESS") {
    throw new BadRequestError(
      "Only an allocation from an in-progress wagon can be cancelled",
    );
  }

  if (data.version !== undefined && data.version !== existing.version) {
    throw new ConflictError("Allocation changed. Please refresh.");
  }

  await tx.vPLoading.update({
    where: {
      id: existing.id,
    },
    data: {
      status: "CANCELLED",
      cancelReason: data.reason,
      cancelledById: data.actorId,
      cancelledAt: new Date(),
      updatedById: data.actorId,
      version: {
        increment: 1,
      },
    },
  });

  // Recalculate total loaded quantity only.
  await recalculateVPWagonLoadingTotals(tx, existing.vpWagonLoadingId, {
    detail: false,
  });

  const activeAllocationCount = await tx.vPLoading.count({
    where: {
      vpWagonLoadingId: existing.vpWagonLoadingId,
      status: "LOADED",
    },
  });

  const gateReleased = activeAllocationCount === 0;

  if (gateReleased) {
    await tx.vPWagonLoading.update({
      where: {
        id: existing.vpWagonLoadingId,
      },
      data: {
        gateNo: null,
        updatedById: data.actorId,
        version: {
          increment: 1,
        },
      },
    });
  }

  await recalculateVpScheduleLoadingStatus(
    tx,
    existing.vpWagonLoading.mrRrRow.mrRr.vpSchedule.id,
    data.actorId,
  );

  return {
    allocationId: existing.id,
    vpWagonLoadingId: existing.vpWagonLoadingId,
    branchId: existing.vpWagonLoading.mrRrRow.mrRr.vpSchedule.fromBranchId,
    gateReleased,
  };
};
