import { Router } from "express";
import type { Request } from "express";
import { PERMS } from "@skerp/types";
import {
  cancelVPLoadingSchema,

  completeVPWagonLoadingSchema,
  createVPLoadingAllocationSchema,
  updateVPLoadingAllocationSchema,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";
import { Prisma } from "../../../generated/prisma/index.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { assertBranchAccess, branchFilter } from "../../auth/branch-scope.js";
import { BadRequestError, ConflictError, NotFoundError, ValidationError } from "../../lib/error.js";
import { sendOk } from "../_shared/response.js";
import { getDateRange } from "../vp-schedule/vp-schedule.route.js";
import {
  allocationInclude,
  assertGRNCompatibleWithRow,
  buildAllocationGoods,
  cancelVPLoadingAllocation,
  createOrGetVPWagonLoading,
  decimalToNumber,
  generateVPLoadingNumber,
  getEligibleGRNsForRow,
  getGRNForLoading,
  getMRRRRowForLoading,
  isVPWagonLoadingOpen,
  labourSelect,
  recalculateVpScheduleLoadingStatus,
  recalculateVPWagonLoadingTotals,
  scheduleHeaderSelect,
  userSelect,
  vpWagonLoadingInclude,
  withAvailability,
} from "./vp-loading.service.js";

const router: Router = Router();
const readClient = db as unknown as Prisma.TransactionClient;

router.use(authMiddleware);

const actorId = (req: { user?: { userId: string } }) => {
  const userId = req.user?.userId;
  if (!userId) throw new BadRequestError("User context is missing");
  return userId;
};

const getIdParam = (value: string | string[] | undefined, label: string) => {
  const id = decodeURIComponent(
    Array.isArray(value) ? value[0] ?? "" : value ?? "",
  ).trim();

  if (!id) throw new BadRequestError(`${label} is required`);
  return id;
};

const assertVersion = (
  clientVersion: number | undefined,
  currentVersion: number,
  message: string,
) => {
  if (clientVersion !== undefined && clientVersion !== currentVersion) {
    throw new ConflictError(message);
  }
};

const mapGRNDropdown = (grn: Awaited<ReturnType<typeof getEligibleGRNsForRow>>[number]) => ({
  grnId: grn.id,
  grnNumber: grn.grnNumber,
  gateNo: grn.gateNo,
  lrId: grn.lorryReceipt.id,
  lrNumber: grn.lorryReceipt.lrNumber,
  consignor: grn.lorryReceipt.group.consignor,
  consignee: grn.lorryReceipt.group.consignee,
  totalReceivedQty: grn.totalReceivedQty,
  allocatedQty: grn.allocatedQty,
  availableQty: grn.availableQty,
  fullyLoaded: grn.fullyLoaded,
  goodsItemCount: grn.goods.length,
});

const getWagonLoadingForReq = async (
  req: Request,
  id: string,
) => {
  const wagon = await db.vPWagonLoading.findUnique({
    where: { id },
    include: vpWagonLoadingInclude,
  });

  if (!wagon) throw new NotFoundError("VP wagon loading not found");
  assertBranchAccess(req, wagon.mrRrRow.mrRr.vpSchedule.fromBranchId);
  return wagon;
};

const getEligibleGRNCountForRow = async (
  mrrrRowId: string,
  loading?: { status: string } | null,
) => {
  if (!isVPWagonLoadingOpen(loading)) return 0;

  try {
    const row = await getMRRRRowForLoading(readClient, mrrrRowId);
    const grns = await getEligibleGRNsForRow(readClient, row);

    return grns.length;
  } catch (error) {
  console.error("Eligible GRN count failed", {
    mrrrRowId,
    error,
  });

  return 0;
}
};

router.get("/schedules", can(PERMS.VP_LOADING.VIEW), async (req, res) => {
  const scheduleDate =
    typeof req.query.scheduleDate === "string"
      ? req.query.scheduleDate
      : undefined;

  const dateRange = scheduleDate ? getDateRange(scheduleDate) : null;
  const where: Prisma.VPScheduleWhereInput = {
    deletedAt: null,
    status: { in: ["MRRR_CREATED", "LOADING", "LOADED", "VERIFIED"] },
    ...branchFilter(req, "fromBranchId"),
    ...(dateRange
      ? { scheduleDate: { gte: dateRange.start, lt: dateRange.end } }
      : {}),
    mrRr: {
      is: {
        deletedAt: null,
        status: "SUBMITTED",
      },
    },
  };

  const schedules = await db.vPSchedule.findMany({
    where,
    select: {
      ...scheduleHeaderSelect,
      mrRr: {
        select: {
          id: true,
          mrRrNumber: true,
          status: true,
          rows: {
            orderBy: { rowNumber: "asc" },
            select: {
              id: true,
              rowNumber: true,
              rowLabel: true,
              vpNo: true,
              mrRrNo: true,
              wagon: {
                select: {
                  id: true,
                  name: true,
                  totalCft: true,
                  capacityMt: true,
                },
              },
              vpWagonLoading: {
                select: {
                  id: true,
                  status: true,
                  gateNo: true,
                  totalLoadedQty: true,
                  version: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { scheduleDate: "desc" },
  });

  const rowsBySchedule = await Promise.all(
    schedules.map(async (schedule) => {
      const rows = schedule.mrRr?.rows ?? [];
      const loadings = rows
        .map((row) => row.vpWagonLoading)
        .filter(Boolean);
      const vpRows = rows.filter((row) => row.vpNo?.trim());
      const openRows = vpRows.filter((row) =>
  isVPWagonLoadingOpen(
    row.vpWagonLoading,
  ),
);

      return {
        ...schedule,
        mrRrSummary: schedule.mrRr
          ? {
              id: schedule.mrRr.id,
              mrRrNumber: schedule.mrRr.mrRrNumber,
              status: schedule.mrRr.status,
            }
          : null,
        totalVpRows: vpRows.length,
        loadingRows: openRows.map((row) => ({
  id: row.id,
  rowNumber: row.rowNumber,
  rowLabel: row.rowLabel,
  vpNo: row.vpNo,
  mrRrNo: row.mrRrNo,
  wagon: row.wagon,
  vpWagonLoading: row.vpWagonLoading,
})),
        loadingWagonCount: loadings.filter((row) => row?.status === "IN_PROGRESS")
          .length,
        completedWagonCount: loadings.filter((row) => row?.status === "COMPLETED")
          .length,
        verifiedWagonCount: loadings.filter((row) => row?.status === "VERIFIED")
          .length,
      };
    }),
  );

  return sendOk(
    res,
    rowsBySchedule.filter((schedule) => schedule.loadingRows.length > 0),
  );
});

router.get("/allocations", can(PERMS.VP_LOADING.VIEW), async (req, res) => {
  const branchWhere =
    req.ctx?.branchScope === "ALL"
      ? {}
      : {
          vpWagonLoading: {
            mrRrRow: {
              mrRr: {
                vpSchedule: {
                  fromBranchId: {
                    in: req.ctx?.branchIds ?? [],
                  },
                },
              },
            },
          },
        };

  const allocations = await db.vPLoading.findMany({
    where: {
      ...branchWhere,
    },
    orderBy: { createdAt: "desc" },
    include: allocationInclude,
  });

  return sendOk(
    res,
    allocations.map((allocation) => {
      const wagonLoading = allocation.vpWagonLoading;
      const mrRrRow = wagonLoading.mrRrRow;
      const mrRr = mrRrRow.mrRr;
      const schedule = mrRr.vpSchedule;

      return {
        id: allocation.id,
        loadingNumber: allocation.loadingNumber,
        status: allocation.status,
        loadedQty: allocation.loadedQty,
        remarks: allocation.remarks,
        cancelReason: allocation.cancelReason,
        cancelledAt: allocation.cancelledAt,
        createdAt: allocation.createdAt,
        updatedAt: allocation.updatedAt,
        version: allocation.version,
        grn: allocation.grn,
        schedule: {
          id: schedule.id,
          scheduleNumber: schedule.scheduleNumber,
          scheduleDate: schedule.scheduleDate,
          scheduleName: schedule.scheduleName,
          status: schedule.status,
          fromBranch: schedule.fromBranch,
          toBranch: schedule.toBranch,
          sourceArea: schedule.sourceArea,
          destinationArea: schedule.destinationArea,
        },
        mrRr: {
          id: mrRr.id,
          mrRrNumber: mrRr.mrRrNumber,
          status: mrRr.status,
        },
        mrRrRow: {
          id: mrRrRow.id,
          rowNumber: mrRrRow.rowNumber,
          rowLabel: mrRrRow.rowLabel,
          vpNo: mrRrRow.vpNo,
          mrRrNo: mrRrRow.mrRrNo,
          wagon: mrRrRow.wagon,
        },
        vpWagonLoading: {
          id: wagonLoading.id,
          status: wagonLoading.status,
          gateNo: wagonLoading.gateNo,
          totalLoadedQty: wagonLoading.totalLoadedQty,
          loadingStartedAt: wagonLoading.loadingStartedAt,
          loadingCompletedAt: wagonLoading.loadingCompletedAt,
          verifiedAt: wagonLoading.verifiedAt,
          version: wagonLoading.version,
        },
      };
    }),
  );
});
//wagon based list At VP Loading table
router.get(
  "/wagons",
  can(PERMS.VP_LOADING.VIEW),
  async (req, res) => {
    const branchWhere: Prisma.VPWagonLoadingWhereInput =
      req.ctx?.branchScope === "ALL"
        ? {}
        : {
            mrRrRow: {
              mrRr: {
                vpSchedule: {
                  fromBranchId: {
                    in: req.ctx?.branchIds ?? [],
                  },
                },
              },
            },
          };

    const wagonLoadings =
      await db.vPWagonLoading.findMany({
        where: branchWhere,

        orderBy: {
          createdAt: "desc",
        },

        select: {
          id: true,
          status: true,

          totalLoadedQty: true,

          loadingStartedAt: true,
          loadingCompletedAt: true,
          verifiedAt: true,
          cancelledAt: true,

          remarks: true,
          cancelReason: true,

          version: true,
          createdAt: true,
          updatedAt: true,

          mrRrRow: {
            select: {
              id: true,
              rowNumber: true,
              rowLabel: true,
              vpNo: true,

              wagon: {
                select: {
                  id: true,
                  name: true,
                  totalCft: true,
                  capacityMt: true,
                },
              },

              mrRr: {
                select: {
                  vpSchedule: {
                    select: scheduleHeaderSelect,
                  },
                },
              },
            },
          },

          // Count only active LR allocations.
          _count: {
            select: {
              allocations: {
                where: {
                  status: {
                    not: "CANCELLED",
                  },
                },
              },
            },
          },
        },
      });

    return sendOk(
      res,
      wagonLoadings.map((wagonLoading) => {
        const mrRrRow =
          wagonLoading.mrRrRow;

        const mrRr = mrRrRow.mrRr;
        const schedule = mrRr.vpSchedule;

        return {
          // VPWagonLoading ID
          id: wagonLoading.id,

          status: wagonLoading.status,

          totalLoadedQty:
            wagonLoading.totalLoadedQty,

          // Number of active LRs in this wagon
          allocationCount:
            wagonLoading._count.allocations,

          loadingStartedAt:
            wagonLoading.loadingStartedAt,

          loadingCompletedAt:
            wagonLoading.loadingCompletedAt,

          verifiedAt:
            wagonLoading.verifiedAt,

          cancelledAt:
            wagonLoading.cancelledAt,

          remarks: wagonLoading.remarks,
          cancelReason:
            wagonLoading.cancelReason,

          version: wagonLoading.version,
          createdAt: wagonLoading.createdAt,
          updatedAt: wagonLoading.updatedAt,

          schedule: {
            id: schedule.id,
            scheduleNumber:
              schedule.scheduleNumber,
            scheduleDate:
              schedule.scheduleDate,
            scheduleName:
              schedule.scheduleName,
            status: schedule.status,

            fromBranch:
              schedule.fromBranch,
            toBranch:
              schedule.toBranch,
            sourceArea:
              schedule.sourceArea,
            destinationArea:
              schedule.destinationArea,
          },

          mrRrRow: {
            id: mrRrRow.id,
            rowNumber:
              mrRrRow.rowNumber,
            rowLabel:
              mrRrRow.rowLabel,
            vpNo: mrRrRow.vpNo,
            wagon: mrRrRow.wagon,
          },
        };
      }),
    );
  },
);
// after select the vp MR RR Number of VP scheudle it show after select teh vp schedule date
router.get(
  "/schedules/:vpScheduleId/preview",
  can(PERMS.VP_LOADING.VIEW),
  async (req, res) => {
    const vpScheduleId = getIdParam(req.params.vpScheduleId, "VP Schedule");

    const schedule = await db.vPSchedule.findFirst({
      where: {
        id: vpScheduleId,
        deletedAt: null,
        status: { in: ["MRRR_CREATED", "LOADING", "LOADED", "VERIFIED"] },
        ...branchFilter(req, "fromBranchId"),
      },
      select: {
        ...scheduleHeaderSelect,
        mrRr: {
          include: {
            rows: {
              orderBy: { rowNumber: "asc" },
              include: {
                wagon: true,
                vpWagonLoading: {
                  select: {
                    id: true,
                    status: true,
                    gateNo: true,
                    totalLoadedQty: true,
                    totalLoadedCft: true,
                    totalLoadedWeightMt: true,
                    capacityCheckStatus: true,
                    labour: { select: labourSelect },
                    labourCharge: true,
                    loadingSupervisor: { select: userSelect },
                    loadingStartedAt: true,
                    loadingCompletedAt: true,
                    verifiedAt: true,
                    cancelledAt: true,
                    remarks: true,
                    cancelReason: true,
                    version: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!schedule?.mrRr) throw new NotFoundError("Submitted MR/RR not found");
    if (schedule.mrRr.status !== "SUBMITTED") {
      throw new BadRequestError("MR/RR must be submitted before VP loading");
    }

    const rowsWithEligibility = await Promise.all(
      schedule.mrRr.rows.map(async (row) => ({
        ...row,
        eligibleGrnCount: await getEligibleGRNCountForRow(
          row.id,
          row.vpWagonLoading,
        ),
      })),
    );

    return sendOk(res, {
      ...schedule,
      mrRr: {
        ...schedule.mrRr,
        rows: rowsWithEligibility,
      },
    });
  },
);
// after select VP no In form then hit this APIs aand Show Gate if has in GRN create
router.get(
  "/rows/:mrrrRowId/gates",
  can(PERMS.VP_LOADING.VIEW),
  async (req, res) => {
    const mrrrRowId = getIdParam(req.params.mrrrRowId, "MR/RR row");
    const row = await getMRRRRowForLoading(readClient, mrrrRowId);
    assertBranchAccess(req, row.mrRr.vpSchedule.fromBranchId);

    const grns = await getEligibleGRNsForRow(readClient, row);
    const eligibleGrns =
  row.vpWagonLoading?.gateNo
    ? grns.filter(
        (grn) =>
          grn.gateNo ===
          row.vpWagonLoading?.gateNo,
      )
    : grns;
    const gates = new Map<
      string,
      { gateNo: string; eligibleGrnCount: number; eligibleLrCount: number; totalAvailableQty: number }
    >();

  for (const grn of eligibleGrns) {
  const gateNo = grn.gateNo?.trim();

  if (!gateNo) continue;

  const current =
    gates.get(gateNo) ?? {
      gateNo,
      eligibleGrnCount: 0,
      eligibleLrCount: 0,
      totalAvailableQty: 0,
    };

  current.eligibleGrnCount += 1;
  current.eligibleLrCount += 1;
  current.totalAvailableQty +=
    grn.availableQty;

  gates.set(gateNo, current);
}

    return sendOk(res, [...gates.values()]);
  },
);
// it run after the select the Gate No and show the GRN(LR) in the Dropdown 
router.get(
  "/rows/:mrrrRowId/gates/:gateNo/grns",
  can(PERMS.VP_LOADING.VIEW),
  async (req, res) => {
    const mrrrRowId = getIdParam(req.params.mrrrRowId, "MR/RR row");
    const gateNo = getIdParam(req.params.gateNo, "Gate No");
    const row = await getMRRRRowForLoading(readClient, mrrrRowId);
    assertBranchAccess(req, row.mrRr.vpSchedule.fromBranchId);
    const lockedGateNo =
  row.vpWagonLoading?.gateNo?.trim();

if (
  lockedGateNo &&
  lockedGateNo !== gateNo
) {
  throw new BadRequestError(
    `This wagon is assigned to Gate ${lockedGateNo}`,
  );
}
    const grns = (await getEligibleGRNsForRow(readClient, row)).filter(
      (grn) => grn.gateNo === gateNo,
    );

    return sendOk(res, grns.map(mapGRNDropdown));
  },
);
// shwo the Preview AFter selecte GRN(LR) from Dropdown 
router.get(
  "/rows/:mrrrRowId/grns/:grnId/preview",
  can(PERMS.VP_LOADING.VIEW),
  async (req, res) => {
    const mrrrRowId = getIdParam(
      req.params.mrrrRowId,
      "MR/RR row",
    );

    const grnId = getIdParam(
      req.params.grnId,
      "GRN",
    );

    // 1. Get and validate selected MR/RR wagon row
    const row = await getMRRRRowForLoading(
      readClient,
      mrrrRowId,
    );

    assertBranchAccess(
      req,
      row.mrRr.vpSchedule.fromBranchId,
    );

    // 2. Get and validate selected GRN/LR
    const grn = await getGRNForLoading(
      readClient,
      grnId,
    );

    assertGRNCompatibleWithRow(row, grn);

    // 3. Calculate remaining available GRN quantity
    const availableGrn = withAvailability(grn);

    if (availableGrn.availableQty <= 0) {
      throw new BadRequestError(
        "GRN has no available quantity for VP loading",
      );
    }

    // 4. Return paperwork and quantity information
    return sendOk(res, {
      schedule: row.mrRr.vpSchedule,

      mrRrRow: row,

      vpWagonLoading: row.vpWagonLoading,

      currentTotals: {
        loadedQty:
          row.vpWagonLoading?.totalLoadedQty ?? 0,
      },

      grn: availableGrn,

      goods: availableGrn.goods.map((goods) => ({
        grnGoodsId: goods.id,
        goodsName: goods.goodsName,

        totalQty: goods.totalQty,
        receivedQty: goods.receivedQty,
        alreadyAllocatedQty: goods.allocatedQty,
        availableQty: goods.availableQty,

        // Frontend can use this as the default loaded quantity
        suggestedLoadQty: goods.availableQty,

        quantityUnit: goods.quantityUnit,

        // Keep these only for displaying GRN paperwork
        weightUnit: goods.weightUnit,
        weight: goods.weight,
      })),

      selectedGrnProjection: {
        loadedQty: availableGrn.availableQty,
      },
    });
  },
);
//creaet one wagon loading
router.post(
  "/rows/:mrrrRowId/allocations",
  can(PERMS.VP_LOADING.CREATE),
  async (req, res) => {
    const mrrrRowId = getIdParam(
      req.params.mrrrRowId,
      "MR/RR row",
    );

    const parsed =
      createVPLoadingAllocationSchema.safeParse(
        req.body,
      );

    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.flatten(),
      );
    }

    const input = parsed.data;
    const userId = actorId(req);

    const result = await db.$transaction(
      async (tx) => {
        // 1. Get the selected MR/RR wagon row
        const row =
          await getMRRRRowForLoading(
            tx,
            mrrrRowId,
          );

        assertBranchAccess(
          req,
          row.mrRr.vpSchedule.fromBranchId,
        );

        // 2. Get selected GRN/LR
        const grn = await getGRNForLoading(
          tx,
          input.grnId,
        );

        assertGRNCompatibleWithRow(row, grn);

        const grnGateNo = grn.gateNo?.trim();

        if (!grnGateNo) {
          throw new BadRequestError(
            "Selected GRN does not have a gate number",
          );
        }

        // 3. Create wagon loading automatically,
        // or get the existing wagon loading
        const wagon =
          await createOrGetVPWagonLoading(tx, {
            mrrrRowId,
            actorId: userId,
            gateNo: grnGateNo,
            labourId: input.labourId,
            labourCharge: input.labourCharge,
            loadingSupervisorId:
              input.loadingSupervisorId,
            remarks: input.remarks,
            version: input.wagonVersion,
          });

        // 4. Check whether this GRN already exists
const existing =
  await tx.vPLoading.findUnique({
    where: {
      vpWagonLoadingId_grnId: {
        vpWagonLoadingId: wagon.id,
        grnId: input.grnId,
      },
    },
    select: {
      id: true,
      status: true,
    },
  });

if (existing && existing.status !== "CANCELLED") {
  throw new ConflictError(
    "This GRN is already added to the selected wagon",
  );
}

// 5. Calculate available LR quantity
const availableGrn = withAvailability(
  grn,
  existing?.id,
);
const allocationGoods =
  buildAllocationGoods(
    availableGrn,
    input.goods,
  );

let allocation: {
  id: string;
};

if (existing?.status === "CANCELLED") {
  /*
   * Remove the goods rows from the old cancelled
   * allocation before recreating them.
   */
  await tx.vPLoadingGoods.deleteMany({
    where: {
      vpLoadingId: existing.id,
    },
  });

  /*
   * Reactivate the cancelled allocation.
   */
  allocation = await tx.vPLoading.update({
    where: {
      id: existing.id,
    },
    data: {
      status: "LOADED",

      loadedQty:
        allocationGoods.totals.loadedQty,

     

      remarks: input.remarks,

      // Clear previous cancellation information
      cancelReason: null,
      cancelledById: null,
      cancelledAt: null,

      updatedById: userId,
      version: {
        increment: 1,
      },

      goods: {
        create: allocationGoods.rows,
      },
    },
    select: {
      id: true,
    },
  });
} else {
  /*
   * No previous allocation exists.
   * Create a new loading number and allocation.
   */
  const loadingNumber =
    await generateVPLoadingNumber(
      tx,
      row.mrRr.vpSchedule.fromBranch
        .branchCode,
    );

  allocation = await tx.vPLoading.create({
    data: {
      loadingNumber,
      vpWagonLoadingId: wagon.id,
      grnId: input.grnId,
      status: "LOADED",

      loadedQty:
        allocationGoods.totals.loadedQty,

      
      remarks: input.remarks,
      createdById: userId,

      goods: {
        create: allocationGoods.rows,
      },
    },
    select: {
      id: true,
    },
  });
}

        // 8. Update wagon capacity totals
        const updatedWagon =
          await recalculateVPWagonLoadingTotals(
            tx,
            wagon.id,
            {
              detail: false,
            },
          );

        return {
          allocationId: allocation.id,
          vpWagonLoadingId: wagon.id,
          wagonVersion: updatedWagon.version,
        };
      },
      {
        maxWait: 5_000,
        timeout: 15_000,
      },
    );

    // Fetch after transaction for fresh totals
    const created =
      await db.vPLoading.findUnique({
        where: {
          id: result.allocationId,
        },
        include: allocationInclude,
      });

    if (!created) {
      throw new NotFoundError(
        "VP loading allocation not found",
      );
    }

    return sendOk(
      res,
      {
        allocation: created,
        vpWagonLoadingId:
          result.vpWagonLoadingId,
        wagonVersion: result.wagonVersion,
      },
      undefined,
      201,
    );
  },
);
router.patch(
  "/allocations/:allocationId",
  can(PERMS.VP_LOADING.UPDATE),
  async (req, res) => {
    const allocationId = getIdParam(req.params.allocationId, "VP loading");
    const parsed = updateVPLoadingAllocationSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.flatten());
    const input = parsed.data;

   const updated = await db.$transaction(async (tx) => {
  const existing = await tx.vPLoading.findUnique({
    where: {
      id: allocationId,
    },
    include: allocationInclude,
  });

  if (!existing) {
    throw new NotFoundError(
      "VP loading allocation not found",
    );
  }

  assertBranchAccess(
    req,
    existing.vpWagonLoading.mrRrRow.mrRr
      .vpSchedule.fromBranchId,
  );

  if (existing.status !== "LOADED") {
    throw new BadRequestError(
      "Only an active loaded allocation can be updated",
    );
  }

  if (
    existing.vpWagonLoading.status !==
    "IN_PROGRESS"
  ) {
    throw new BadRequestError(
      "Only an in-progress wagon can be updated",
    );
  }

  assertVersion(
    input.version,
    existing.version,
    "Allocation changed. Please refresh.",
  );

  const row = await getMRRRRowForLoading(
    tx,
    existing.vpWagonLoading.mrRrRowId,
  );

  const grn = await getGRNForLoading(
    tx,
    existing.grnId,
  );

  assertGRNCompatibleWithRow(row, grn);

  // Exclude this allocation so its existing quantity
  // remains available while editing.
  const availableGrn = withAvailability(
    grn,
    existing.id,
  );

  const allocationGoods =
    buildAllocationGoods(
      availableGrn,
      input.goods,
    );

  await tx.vPLoadingGoods.deleteMany({
    where: {
      vpLoadingId: existing.id,
    },
  });

  await tx.vPLoading.update({
    where: {
      id: existing.id,
    },
    data: {
      loadedQty:
        allocationGoods.totals.loadedQty,
      remarks: input.remarks,
      updatedById: actorId(req),
      version: {
        increment: 1,
      },
      goods: {
        create: allocationGoods.rows,
      },
    },
  });

  // Recalculate only totalLoadedQty.
  await recalculateVPWagonLoadingTotals(
    tx,
    existing.vpWagonLoadingId,
    {
      detail: false,
    },
  );

  // Fetch after recalculation to return fresh wagon totals.
  const allocation =
    await tx.vPLoading.findUnique({
      where: {
        id: existing.id,
      },
      include: allocationInclude,
    });

  if (!allocation) {
    throw new NotFoundError(
      "Updated VP loading allocation not found",
    );
  }

  return allocation;
});

    return sendOk(res, updated);
  },
);
router.post(
  "/allocations/:allocationId/cancel",
  can(PERMS.VP_LOADING.CANCEL),
  async (req, res) => {
    const allocationId = getIdParam(
      req.params.allocationId,
      "VP loading allocation",
    );

    const parsed =
      cancelVPLoadingSchema.safeParse(
        req.body,
      );

    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.flatten(),
      );
    }

    const userId = actorId(req);

    /*
     * Read branch before mutation if branch validation
     * is not performed inside the transaction service.
     */
    const allocation =
      await db.vPLoading.findUnique({
        where: {
          id: allocationId,
        },
        select: {
          vpWagonLoading: {
            select: {
              mrRrRow: {
                select: {
                  mrRr: {
                    select: {
                      vpSchedule: {
                        select: {
                          fromBranchId: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

    if (!allocation) {
      throw new NotFoundError(
        "VP loading allocation not found",
      );
    }

    assertBranchAccess(
      req,
      allocation.vpWagonLoading.mrRrRow.mrRr
        .vpSchedule.fromBranchId,
    );

    const result = await db.$transaction(
      (tx) =>
        cancelVPLoadingAllocation(tx, {
          allocationId,
          actorId: userId,
          version: parsed.data.version,
          reason: parsed.data.reason,
        }),
    );

    const cancelled =
      await db.vPLoading.findUnique({
        where: {
          id: result.allocationId,
        },
        include: allocationInclude,
      });

    if (!cancelled) {
      throw new NotFoundError(
        "Cancelled allocation not found",
      );
    }

    return sendOk(res, {
      allocation: cancelled,
      vpWagonLoadingId:
        result.vpWagonLoadingId,
      gateReleased: result.gateReleased,
    });
  },
);
router.get(
  "/wagons/:vpWagonLoadingId/allocations",
  can(PERMS.VP_LOADING.VIEW),
  async (req, res) => {
    const vpWagonLoadingId = getIdParam(
      req.params.vpWagonLoadingId,
      "VP wagon loading",
    );

    /*
     * Validate selected wagon and branch access.
     */
    await getWagonLoadingForReq(
      req,
      vpWagonLoadingId,
    );

    /*
     * 1. Get allocations belonging to the
     * selected wagon.
     *
     * Cancelled allocations are also returned
     * because they are part of loading history.
     */
    const allocations =
      await db.vPLoading.findMany({
        where: {
          vpWagonLoadingId,
        },
        orderBy: {
          createdAt: "desc",
        },
        include: allocationInclude,
      });

    if (!allocations.length) {
      return sendOk(res, []);
    }

    /*
     * Unique GRNs used by this wagon.
     */
    const grnIds = [
      ...new Set(
        allocations.map(
          (allocation) =>
            allocation.grnId,
        ),
      ),
    ];

    /*
     * 2. Get total received quantity for
     * every selected GRN.
     */
    const grns = await db.gRN.findMany({
      where: {
        id: {
          in: grnIds,
        },
      },
      select: {
        id: true,

        goods: {
          select: {
            receivedQty: true,
          },
        },
      },
    });

    const totalReceivedByGrn =
      new Map(
        grns.map((grn) => [
          grn.id,

          grn.goods.reduce(
            (sum, goods) =>
              sum +
              Number(
                goods.receivedQty ?? 0,
              ),
            0,
          ),
        ]),
      );

    /*
     * 3. Calculate total active loaded
     * quantity across every wagon.
     *
     * This query is not branch-filtered because
     * availability must consider every active
     * allocation. It only returns totals and
     * does not expose another branch's details.
     */
    const activeTotals =
      await db.vPLoading.groupBy({
        by: ["grnId"],

        where: {
          grnId: {
            in: grnIds,
          },

          status: {
            not: "CANCELLED",
          },
        },

        _sum: {
          loadedQty: true,
        },
      });

    const totalLoadedByGrn =
      new Map(
        activeTotals.map((row) => [
          row.grnId,
          Number(
            row._sum.loadedQty ?? 0,
          ),
        ]),
      );

    /*
     * Apply branch access while returning
     * other-wagon identifying information.
     */
    const relatedBranchWhere:
      Prisma.VPLoadingWhereInput =
      req.ctx?.branchScope === "ALL"
        ? {}
        : {
            vpWagonLoading: {
              mrRrRow: {
                mrRr: {
                  vpSchedule: {
                    fromBranchId: {
                      in:
                        req.ctx
                          ?.branchIds ?? [],
                    },
                  },
                },
              },
            },
          };

    /*
     * 4. Find active allocations for the
     * same GRNs in other accessible wagons.
     */
    const otherAllocations =
      await db.vPLoading.findMany({
        where: {
          grnId: {
            in: grnIds,
          },

          status: {
            not: "CANCELLED",
          },

          vpWagonLoadingId: {
            not: vpWagonLoadingId,
          },

          ...relatedBranchWhere,
        },

        select: {
          id: true,
          grnId: true,
          loadedQty: true,
          status: true,

          vpWagonLoading: {
            select: {
              id: true,
              status: true,
              gateNo: true,

              mrRrRow: {
                select: {
                  id: true,
                  vpNo: true,
                  rowLabel: true,

                  wagon: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },

                  mrRr: {
                    select: {
                      vpSchedule: {
                        select: {
                          id: true,
                          scheduleNumber:
                            true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

    /*
     * Group other-wagon records by GRN.
     */
    const otherWagonsByGrn =
      new Map<
        string,
        Array<{
          allocationId: string;
          vpWagonLoadingId: string;
          scheduleId: string;
          scheduleNumber: string;
          mrrrRowId: string;
          vpNo: string | null;
          wagonId: string | null;
          wagonName: string | null;
          gateNo: string | null;
          loadedQty: number;
          status: string;
        }>
      >();

    for (
      const allocation of otherAllocations
    ) {
      const loading =
        allocation.vpWagonLoading;

      const row = loading.mrRrRow;
      const schedule =
        row.mrRr.vpSchedule;

      const current =
        otherWagonsByGrn.get(
          allocation.grnId,
        ) ?? [];

      current.push({
        allocationId: allocation.id,

        vpWagonLoadingId:
          loading.id,

        scheduleId:
          schedule.id,

        scheduleNumber:
          schedule.scheduleNumber,

        mrrrRowId: row.id,

        vpNo:
          row.vpNo ??
          row.rowLabel ??
          null,

        wagonId:
          row.wagon?.id ?? null,

        wagonName:
          row.wagon?.name ?? null,

        gateNo:
          loading.gateNo ?? null,

        loadedQty:
          Number(
            allocation.loadedQty,
          ),

        status:
          loading.status,
      });

      otherWagonsByGrn.set(
        allocation.grnId,
        current,
      );
    }

    /*
     * 5. Return current allocations with
     * quantity and split-wagon information.
     */
    const response = allocations.map(
      (allocation) => {
        const totalReceivedQty =
          totalReceivedByGrn.get(
            allocation.grnId,
          ) ?? 0;

        const totalLoadedQty =
          totalLoadedByGrn.get(
            allocation.grnId,
          ) ?? 0;

        /*
         * A cancelled allocation does not
         * contribute to current loading.
         */
        const loadedInCurrentWagon =
          allocation.status ===
          "CANCELLED"
            ? 0
            : Number(
                allocation.loadedQty,
              );

        const loadedInOtherWagons =
          Math.max(
            totalLoadedQty -
              loadedInCurrentWagon,
            0,
          );

        const availableQty =
          Math.max(
            totalReceivedQty -
              totalLoadedQty,
            0,
          );

        return {
          ...allocation,

          quantitySummary: {
            totalReceivedQty,

            loadedInCurrentWagon,

            loadedInOtherWagons,

            totalLoadedQty,

            availableQty,
          },

          otherWagons:
            otherWagonsByGrn.get(
              allocation.grnId,
            ) ?? [],
        };
      },
    );

    return sendOk(res, response);
  },
);

router.post(
  "/wagons/:vpWagonLoadingId/complete",
  can(PERMS.VP_LOADING.COMPLETE),
  async (req, res) => {
    const vpWagonLoadingId = getIdParam(
      req.params.vpWagonLoadingId,
      "VP wagon loading",
    );
    const parsed = completeVPWagonLoadingSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.flatten());

    const completed = await db.$transaction(
      async (tx) => {
        const current = await tx.vPWagonLoading.findUnique({
          where: { id: vpWagonLoadingId },
          include: vpWagonLoadingInclude,
        });
        if (!current) throw new NotFoundError("VP wagon loading not found");
        assertBranchAccess(req, current.mrRrRow.mrRr.vpSchedule.fromBranchId);
        if (!["IN_PROGRESS", "COMPLETED"].includes(current.status)) {
          throw new BadRequestError(
            "Only in-progress or completed wagon can be finished",
          );
        }
        assertVersion(parsed.data.version, current.version, "Wagon loading changed. Please refresh.");

        const activeAllocations = current.allocations.filter(
          (allocation) => allocation.status !== "CANCELLED",
        );
        if (!activeAllocations.length) {
          throw new BadRequestError("At least one loaded allocation is required");
        }
        if (activeAllocations.some((allocation) => allocation.status !== "LOADED")) {
          throw new BadRequestError("All active allocations must be loaded");
        }

        const userId = actorId(req);
        const finishedAt = new Date();
        const wagon = await tx.vPWagonLoading.update({
          where: { id: current.id },
          data: {
            status: "VERIFIED",
            loadingCompletedAt: current.loadingCompletedAt ?? finishedAt,
            verifiedById: userId,
            verifiedAt: finishedAt,
            updatedById: userId,
            version: { increment: 1 },
          },
          include: vpWagonLoadingInclude,
        });
        await recalculateVpScheduleLoadingStatus(
          tx,
          current.mrRrRow.mrRr.vpSchedule.id,
          userId,
        );
        return wagon;
      },
      {
        maxWait: 5_000,
        timeout: 15_000,
      },
    );

    return sendOk(res, completed);
  },
);

router.post(
  "/wagons/:vpWagonLoadingId/cancel",
  can(PERMS.VP_LOADING.CANCEL),
  async (req, res) => {
    const vpWagonLoadingId = getIdParam(
      req.params.vpWagonLoadingId,
      "VP wagon loading",
    );
    const parsed = cancelVPLoadingSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.flatten());

    const cancelled = await db.$transaction(async (tx) => {
      const current = await tx.vPWagonLoading.findUnique({
        where: { id: vpWagonLoadingId },
        include: vpWagonLoadingInclude,
      });
      if (!current) throw new NotFoundError("VP wagon loading not found");
      assertBranchAccess(req, current.mrRrRow.mrRr.vpSchedule.fromBranchId);
      if (current.status === "VERIFIED") {
        throw new BadRequestError("Verified wagon cannot be cancelled");
      }
      if (current.status === "CANCELLED") {
        throw new BadRequestError("Wagon is already cancelled");
      }
      if (current.allocations.some((allocation) => allocation.status !== "CANCELLED")) {
        throw new BadRequestError("Cancel active allocations before cancelling wagon");
      }
      assertVersion(parsed.data.version, current.version, "Wagon loading changed. Please refresh.");

      const wagon = await tx.vPWagonLoading.update({
        where: { id: current.id },
        data: {
          status: "CANCELLED",
          cancelReason: parsed.data.reason,
          cancelledById: actorId(req),
          cancelledAt: new Date(),
          updatedById: actorId(req),
          version: { increment: 1 },
        },
        include: vpWagonLoadingInclude,
      });
      await recalculateVpScheduleLoadingStatus(
        tx,
        current.mrRrRow.mrRr.vpSchedule.id,
        actorId(req),
      );
      return wagon;
    }, {
      maxWait: 5_000,
      timeout: 15_000,
    });

    return sendOk(res, cancelled);
  },
);

export default router;
