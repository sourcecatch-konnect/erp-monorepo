import { Router } from "express";
import type { Request } from "express";
import { PERMS } from "@skerp/types";
import {
  cancelVPLoadingSchema,
  completeVPWagonLoadingSchema,
  createVPLoadingAllocationSchema,
  finaliseVPScheduleLoadingSchema,
  assignOneLapTrackerSchema,
  releaseOneLapTrackerSchema,
  replaceOneLapTrackerSchema,
  updateVPWagonLoadingLabourSchema,
  updateVPLoadingAllocationSchema,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";
import { Prisma } from "../../../generated/prisma/index.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can, canAny } from "../../auth/can.middleware.js";
import { assertBranchAccess, branchFilter } from "../../auth/branch-scope.js";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../lib/error.js";
import { fyCodeFor, nextSequence } from "../_shared/doc-number.js";
import { sendOk } from "../_shared/response.js";
import { getDateRange } from "../vp-schedule/vp-schedule.route.js";
import {
  getCachedEligibleGrns,
  invalidateEligibleGrns,
  setCachedEligibleGrns,
} from "./vp-loading.cache.js";
import {
  assignOneLapTracker,
  getActiveTrackerAssignment,
  listAvailableOneLapTrackers,
  releaseOneLapTracker,
  replaceOneLapTracker,
} from "../one-lap-tracker/one-lap-tracker.assignment.service.js";
import {
  allocationInclude,
  assertGRNCompatibleWithRow,
  branchSelect,
  buildAllocationGoods,
  cancelVPLoadingAllocation,
  customerSelect,
  type EligibilityScheduleRoute,
  generateVPLoadingNumber,
  getCurrentGRNAvailability,
  getEligibleGRNsForRow,
  getGRNForLoading,
  getMRRRRowForLoading,
  isVPWagonLoadingOpen,
  labourSelect,
  mergeVPLoadingGoods,
  recalculateVpScheduleLoadingStatus,
  recalculateVPWagonLoadingTotals,
  scheduleHeaderSelect,
  userSelect,
  vpWagonLoadingInclude,
  withAvailability,
} from "./vp-loading.service.js";

const router: Router = Router();
const readClient = db as unknown as Prisma.TransactionClient;
const VP_LOADING_TX_BUDGET = { timeout: 15_000, maxWait: 10_000 } as const;

router.use(authMiddleware);

const actorId = (req: { user?: { userId: string } }) => {
  const userId = req.user?.userId;
  if (!userId) throw new BadRequestError("User context is missing");
  return userId;
};

const assertLoadingSupervisor = async (
  tx: Prisma.TransactionClient,
  supervisorId: string | undefined,
  branchId: string,
) => {
  if (!supervisorId) return;

  const supervisor = await tx.labour.findFirst({
    where: {
      id: supervisorId,
      branchId,
      type: "Supervisor",
    },
    select: { id: true },
  });

  if (!supervisor) {
    throw new BadRequestError(
      "Select a Supervisor from the Labour master for the VP Schedule branch",
    );
  }
};

const getIdParam = (value: string | string[] | undefined, label: string) => {
  const id = decodeURIComponent(
    Array.isArray(value) ? (value[0] ?? "") : (value ?? ""),
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

const mapGRNDropdown = (
  grn: Awaited<ReturnType<typeof getEligibleGRNsForRow>>[number],
) => ({
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

const toMoney = (value: number | undefined) =>
  value === undefined ? undefined : BigInt(Math.round(value * 100));

const getWagonLoadingForReq = async (req: Request, id: string) => {
  const wagon = await db.vPWagonLoading.findUnique({
    where: { id },
    include: vpWagonLoadingInclude,
  });

  if (!wagon) throw new NotFoundError("VP wagon loading not found");
  assertBranchAccess(req, wagon.mrRrRow.mrRr.vpSchedule.fromBranchId);
  return wagon;
};

/**
 * Eligibility only depends on the schedule's route (fromBranch/toBranch/
 * source/destination area), not on the individual row — so this resolves it
 * once for the whole schedule instead of once per row. Previously this ran
 * two queries (row + eligible-GRN fetch) per wagon row, ~84 queries for a
 * 42-wagon rake to produce the same integer 42 times.
 */
const getEligibleGRNCountForSchedule = async (
  schedule: EligibilityScheduleRoute,
) => {
  try {
    const cached = await getCachedEligibleGrns<
      ReturnType<typeof mapGRNDropdown>[]
    >(schedule);

    if (cached) return cached.length;

    const grns = await getEligibleGRNsForRow(readClient, schedule);
    await setCachedEligibleGrns(schedule, grns.map(mapGRNDropdown));

    return grns.length;
  } catch (error) {
    console.error("Eligible GRN count failed", {
      scheduleFromBranchId: schedule.fromBranchId,
      scheduleToBranchId: schedule.toBranchId,
      error,
    });

    return 0;
  }
};

const assertTrackerScheduleAccess = async (
  req: Request,
  vpScheduleId: string,
) => {
  const schedule = await db.vPSchedule.findFirst({
    where: {
      id: vpScheduleId,
      deletedAt: null,
      ...branchFilter(req, "fromBranchId"),
    },
    select: { id: true },
  });

  if (!schedule) throw new NotFoundError("VP Schedule not found");
};

router.get("/supervisors", can(PERMS.VP_LOADING.VIEW), async (req, res) => {
  const vpScheduleId = getIdParam(
    req.query.vpScheduleId as string | string[] | undefined,
    "VP Schedule",
  );
  const schedule = await db.vPSchedule.findFirst({
    where: {
      id: vpScheduleId,
      deletedAt: null,
      ...branchFilter(req, "fromBranchId"),
    },
    select: { fromBranchId: true },
  });

  if (!schedule) throw new NotFoundError("VP Schedule not found");

  const supervisors = await db.labour.findMany({
    where: {
      branchId: schedule.fromBranchId,
      type: "Supervisor",
    },
    select: {
      id: true,
      name: true,
      mobileNo: true,
    },
    orderBy: { name: "asc" },
  });

  return sendOk(res, supervisors);
});

router.get(
  "/schedules/:vpScheduleId/tracker-assignment",
  can(PERMS.VP_LOADING.VIEW),
  async (req, res) => {
    const vpScheduleId = getIdParam(req.params.vpScheduleId, "VP Schedule");
    await assertTrackerScheduleAccess(req, vpScheduleId);
    return sendOk(res, await getActiveTrackerAssignment(vpScheduleId));
  },
);

router.get(
  "/schedules/:vpScheduleId/available-trackers",
  can(PERMS.VP_LOADING.VIEW),
  async (req, res) => {
    const vpScheduleId = getIdParam(req.params.vpScheduleId, "VP Schedule");
    await assertTrackerScheduleAccess(req, vpScheduleId);
    return sendOk(res, await listAvailableOneLapTrackers());
  },
);

router.post(
  "/schedules/:vpScheduleId/tracker-assignment",
  can(PERMS.VP_LOADING.ASSIGN_TRACKER),
  async (req, res) => {
    const vpScheduleId = getIdParam(req.params.vpScheduleId, "VP Schedule");
    await assertTrackerScheduleAccess(req, vpScheduleId);

    const parsed = assignOneLapTrackerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten());
    }

    return sendOk(
      res,
      await assignOneLapTracker(vpScheduleId, parsed.data, actorId(req)),
    );
  },
);

router.post(
  "/schedules/:vpScheduleId/tracker-assignment/replace",
  can(PERMS.VP_LOADING.REPLACE_TRACKER),
  async (req, res) => {
    const vpScheduleId = getIdParam(req.params.vpScheduleId, "VP Schedule");
    await assertTrackerScheduleAccess(req, vpScheduleId);

    const parsed = replaceOneLapTrackerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten());
    }

    return sendOk(
      res,
      await replaceOneLapTracker(vpScheduleId, parsed.data, actorId(req)),
    );
  },
);

router.post(
  "/schedules/:vpScheduleId/tracker-assignment/release",
  can(PERMS.VP_LOADING.RELEASE_TRACKER),
  async (req, res) => {
    const vpScheduleId = getIdParam(req.params.vpScheduleId, "VP Schedule");
    await assertTrackerScheduleAccess(req, vpScheduleId);

    const parsed = releaseOneLapTrackerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten());
    }

    return sendOk(
      res,
      await releaseOneLapTracker(
        vpScheduleId,
        parsed.data.reason,
        actorId(req),
      ),
    );
  },
);

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
        // Narrows to schedules that can actually appear in the response below
        // (at least one row with a VP number and an open wagon loading) so we
        // don't hydrate the full nested tree for schedules we'd only discard.
        // The exact isVPWagonLoadingOpen/trim() logic still runs afterward as
        // the source of truth — this is a pre-filter, not a replacement.
        rows: {
          some: {
            vpNo: { not: null },
            OR: [
              { vpWagonLoading: null },
              {
                vpWagonLoading: {
                  status: { in: ["DRAFT", "IN_PROGRESS"] },
                },
              },
            ],
          },
        },
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
      const loadings = rows.map((row) => row.vpWagonLoading).filter(Boolean);
      const vpRows = rows.filter((row) => row.vpNo?.trim());
      const openRows = vpRows.filter((row) =>
        isVPWagonLoadingOpen(row.vpWagonLoading),
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
        loadingWagonCount: loadings.filter(
          (row) => row?.status === "IN_PROGRESS",
        ).length,
        completedWagonCount: loadings.filter(
          (row) => row?.status === "COMPLETED",
        ).length,
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

//wagon based list At VP Loading table
router.get("/wagons", can(PERMS.VP_LOADING.VIEW), async (req, res) => {
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

  const wagonLoadings = await db.vPWagonLoading.findMany({
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
      const mrRrRow = wagonLoading.mrRrRow;

      const mrRr = mrRrRow.mrRr;
      const schedule = mrRr.vpSchedule;

      return {
        // VPWagonLoading ID
        id: wagonLoading.id,

        status: wagonLoading.status,

        totalLoadedQty: wagonLoading.totalLoadedQty,

        // Number of active LRs in this wagon
        allocationCount: wagonLoading._count.allocations,

        loadingStartedAt: wagonLoading.loadingStartedAt,

        loadingCompletedAt: wagonLoading.loadingCompletedAt,

        verifiedAt: wagonLoading.verifiedAt,

        cancelledAt: wagonLoading.cancelledAt,

        remarks: wagonLoading.remarks,
        cancelReason: wagonLoading.cancelReason,

        version: wagonLoading.version,
        createdAt: wagonLoading.createdAt,
        updatedAt: wagonLoading.updatedAt,

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

        mrRrRow: {
          id: mrRrRow.id,
          rowNumber: mrRrRow.rowNumber,
          rowLabel: mrRrRow.rowLabel,
          vpNo: mrRrRow.vpNo,
          wagon: mrRrRow.wagon,
        },
      };
    }),
  );
});
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
        status: {
          in: ["MRRR_CREATED", "LOADING", "LOADED", "VERIFIED", "FINALISED"],
        },
        ...branchFilter(req, "fromBranchId"),
      },
      select: {
        ...scheduleHeaderSelect,
        railRake: {
          select: {
            id: true,
            rakeNumber: true,
            status: true,
            generatedAt: true,
          },
        },
        trackerAssignments: {
          where: { releasedAt: null },
          take: 1,
          select: {
            id: true,
            tracker: {
              select: {
                id: true,
                name: true,
                isEnabled: true,
                isPresentOnProvider: true,
                validityAt: true,
              },
            },
            installedOnMrRrRow: {
              select: { id: true, vpNo: true },
            },
          },
        },
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
                    labourId: true,
                    labour: { select: labourSelect },
                    labourCharge: true,
                    loadingSupervisorId: true,
                    loadingSupervisor: { select: labourSelect },
                    loadingStartedAt: true,
                    loadingCompletedAt: true,
                    verifiedAt: true,
                    cancelledAt: true,
                    remarks: true,
                    cancelReason: true,
                    version: true,
                    _count: {
                      select: {
                        allocations: {
                          where: { status: { not: "CANCELLED" } },
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
    });

    if (!schedule?.mrRr) throw new NotFoundError("Submitted MR/RR not found");
    if (schedule.mrRr.status !== "SUBMITTED") {
      throw new BadRequestError("MR/RR must be submitted before VP loading");
    }

    // Resolved once for the schedule's route, not once per row (see
    // getEligibleGRNCountForSchedule) — every open row shares this same count.
    const scheduleEligibleGrnCount =
      await getEligibleGRNCountForSchedule(schedule);

    const rowsWithEligibility = schedule.mrRr.rows.map((row) => ({
      ...row,
      vpWagonLoading: row.vpWagonLoading
        ? {
          ...row.vpWagonLoading,
          activeLrCount: row.vpWagonLoading._count.allocations,
        }
        : null,
      eligibleGrnCount: isVPWagonLoadingOpen(row.vpWagonLoading)
        ? scheduleEligibleGrnCount
        : 0,
    }));

    return sendOk(res, {
      ...schedule,
      mrRr: {
        ...schedule.mrRr,
        rows: rowsWithEligibility,
      },
    });
  },
);

router.get(
  "/schedules/:vpScheduleId/final-review",
  can(PERMS.VP_LOADING.VIEW),
  async (req, res) => {
    const vpScheduleId = getIdParam(req.params.vpScheduleId, "VP Schedule");

    const schedule = await db.vPSchedule.findFirst({
      where: {
        id: vpScheduleId,
        deletedAt: null,
        ...branchFilter(req, "fromBranchId"),
      },
      select: {
        ...scheduleHeaderSelect,
        remarks: true,
        version: true,
        finalisedAt: true,
        finalisedById: true,
        finalisedBy: { select: userSelect },
        railRake: {
          select: {
            id: true,
            rakeNumber: true,
            status: true,
            generatedAt: true,
          },
        },
        trackerAssignments: {
          where: { releasedAt: null },
          take: 1,
          select: {
            id: true,
            tracker: {
              select: {
                id: true,
                name: true,
                isEnabled: true,
                isPresentOnProvider: true,
                validityAt: true,
              },
            },
            installedOnMrRrRow: {
              select: { id: true, vpNo: true },
            },
          },
        },
        mrRr: {
          select: {
            id: true,
            mrRrNumber: true,
            status: true,
            rakeType: true,
            remarks: true,
            version: true,
            rows: {
              orderBy: { rowNumber: "asc" },
              select: {
                id: true,
                rowNumber: true,
                rowLabel: true,
                wagonTypeLabel: true,
                sequenceNo: true,
                vpNo: true,
                mrRrNo: true,
                sealNo: true,
                wagon: {
                  select: {
                    id: true,
                    name: true,
                    capacityMt: true,
                    totalCft: true,
                  },
                },
                vpWagonLoading: {
                  select: {
                    id: true,
                    status: true,
                    gateNo: true,
                    totalLoadedQty: true,
                    totalLoadedCft: true,
                    totalLoadedWeightMt: true,
                    capacityCheckStatus: true,
                    labourCharge: true,
                    labour: { select: labourSelect },
                    loadingSupervisor: { select: labourSelect },
                    loadingStartedAt: true,
                    loadingCompletedAt: true,
                    verifiedAt: true,
                    verifiedBy: { select: userSelect },
                    remarks: true,
                    version: true,
                    allocations: {
                      where: { status: "LOADED" },
                      orderBy: { createdAt: "asc" },
                      select: {
                        id: true,
                        loadingNumber: true,
                        status: true,
                        loadedQty: true,
                        loadedCft: true,
                        loadedWeightMt: true,
                        remarks: true,
                        grn: {
                          select: {
                            id: true,
                            grnNumber: true,
                            gateNo: true,
                            lorryReceipt: {
                              select: {
                                id: true,
                                lrNumber: true,
                                group: {
                                  select: {
                                    id: true,
                                    groupNumber: true,
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
                          orderBy: { createdAt: "asc" },
                          select: {
                            id: true,
                            grnGoodsId: true,
                            loadedQty: true,
                            loadingDamageQty: true,
                            loadedWeightMt: true,
                            loadedCft: true,
                            measurementSource: true,
                            remarks: true,
                            grnGoods: {
                              select: {
                                id: true,
                                goodsName: true,
                                description: true,
                                unit: true,
                                quantityUnit: {
                                  select: {
                                    id: true,
                                    code: true,
                                    name: true,
                                  },
                                },
                                weightUnit: {
                                  select: {
                                    id: true,
                                    code: true,
                                    name: true,
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
            },
          },
        },
      },
    });

    if (!schedule) throw new NotFoundError("VP Schedule not found");

    const validationIssues: Array<{
      code: string;
      message: string;
      mrrrRowId?: string;
      vpNo?: string | null;
    }> = [];

    if (schedule.status === "FINALISED" || schedule.railRake) {
      validationIssues.push({
        code: "SCHEDULE_ALREADY_FINALISED",
        message: "VP Schedule is already finalised and has a Rail Rake",
      });
    } else if (!["LOADED", "VERIFIED"].includes(schedule.status)) {
      validationIssues.push({
        code: "SCHEDULE_NOT_LOADED",
        message: "Every VP wagon must be marked Loaded before finalisation",
      });
    }

    if (!schedule.mrRr) {
      validationIssues.push({
        code: "MRRR_MISSING",
        message: "VP Schedule does not have an MR/RR",
      });
    } else {
      if (schedule.mrRr.status !== "SUBMITTED") {
        validationIssues.push({
          code: "MRRR_NOT_SUBMITTED",
          message: "MR/RR must be submitted before finalisation",
        });
      }

      if (schedule.mrRr.rows.length === 0) {
        validationIssues.push({
          code: "MRRR_ROWS_MISSING",
          message: "MR/RR does not contain any wagon rows",
        });
      }

      for (const row of schedule.mrRr.rows) {
        if (!row.vpNo?.trim()) {
          validationIssues.push({
            code: "VP_NUMBER_MISSING",
            message: `${row.rowLabel} does not have a VP number`,
            mrrrRowId: row.id,
            vpNo: row.vpNo,
          });
        }

        if (!row.vpWagonLoading) {
          validationIssues.push({
            code: "WAGON_LOADING_MISSING",
            message: `${row.rowLabel} does not have a VP wagon loading`,
            mrrrRowId: row.id,
            vpNo: row.vpNo,
          });
        } else if (
          !["COMPLETED", "VERIFIED"].includes(row.vpWagonLoading.status)
        ) {
          validationIssues.push({
            code: "WAGON_LOADING_NOT_LOADED",
            message: `${row.rowLabel} VP wagon is not marked Loaded`,
            mrrrRowId: row.id,
            vpNo: row.vpNo,
          });
        }
      }
    }

    const rows = schedule.mrRr?.rows ?? [];
    const loadings = rows
      .map((row) => row.vpWagonLoading)
      .filter(
        (loading): loading is NonNullable<typeof loading> => loading !== null,
      );
    const allocations = loadings.flatMap((loading) => loading.allocations);
    const goods = allocations.flatMap((allocation) => allocation.goods);

    return sendOk(res, {
      schedule,
      summary: {
        totalWagonRows: rows.length,
        wagonLoadingsCreated: loadings.length,
        verifiedWagonCount: loadings.filter((loading) =>
          ["COMPLETED", "VERIFIED"].includes(loading.status),
        ).length,
        activeAllocationCount: allocations.length,
        sourceGoodsLineCount: goods.length,
        totalLoadedQty: loadings.reduce(
          (total, loading) => total + loading.totalLoadedQty,
          0,
        ),
        totalLoadingDamageQty: goods.reduce(
          (total, item) => total + item.loadingDamageQty,
          0,
        ),
      },
      canFinalise: validationIssues.length === 0,
      validationIssues,
    });
  },
);

router.post(
  "/schedules/:vpScheduleId/finalise",
  can(PERMS.VP_LOADING.COMPLETE),
  async (req, res) => {
    const vpScheduleId = getIdParam(req.params.vpScheduleId, "VP Schedule");
    const parsed = finaliseVPScheduleLoadingSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten());
    }

    const accessibleSchedule = await db.vPSchedule.findFirst({
      where: {
        id: vpScheduleId,
        deletedAt: null,
        ...branchFilter(req, "fromBranchId"),
      },
      select: { id: true },
    });

    if (!accessibleSchedule) {
      throw new NotFoundError("VP Schedule not found");
    }

    const userId = actorId(req);
    const input = parsed.data;

    const result = await db.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "VPSchedule"
        WHERE "id" = ${vpScheduleId}
        FOR UPDATE
      `;

      const schedule = await tx.vPSchedule.findUnique({
        where: { id: vpScheduleId },
        select: {
          id: true,
          scheduleNumber: true,
          status: true,
          version: true,
          deletedAt: true,
          fromBranchId: true,
          toBranchId: true,
          fromBranch: { select: branchSelect },
          toBranch: { select: branchSelect },
          railRake: {
            include: {
              fromBranch: { select: branchSelect },
              toBranch: { select: branchSelect },
            },
          },
          trackerAssignments: {
            where: { releasedAt: null },
            take: 1,
            select: {
              id: true,
              tracker: {
                select: {
                  isEnabled: true,
                  isPresentOnProvider: true,
                  validityAt: true,
                },
              },
            },
          },
          mrRr: {
            select: {
              status: true,
              rows: {
                orderBy: { rowNumber: "asc" },
                select: {
                  id: true,
                  rowLabel: true,
                  vpNo: true,
                  vpWagonLoading: {
                    select: {
                      id: true,
                      status: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!schedule || schedule.deletedAt) {
        throw new NotFoundError("VP Schedule not found");
      }

      if (schedule.status === "FINALISED" && schedule.railRake) {
        return {
          railRake: schedule.railRake,
          schedule: {
            id: schedule.id,
            scheduleNumber: schedule.scheduleNumber,
            status: schedule.status,
            version: schedule.version,
          },
          alreadyFinalised: true,
        };
      }

      if (schedule.railRake || schedule.status === "FINALISED") {
        throw new ConflictError(
          "VP Schedule finalisation data is inconsistent. Please contact support.",
        );
      }

      assertVersion(
        input.version,
        schedule.version,
        "VP Schedule changed. Please refresh the final review.",
      );

      if (!["LOADED", "VERIFIED"].includes(schedule.status)) {
        throw new BadRequestError(
          "Every VP wagon must be marked Loaded before finalisation",
        );
      }

      if (!schedule.mrRr || schedule.mrRr.status !== "SUBMITTED") {
        throw new BadRequestError(
          "Submitted MR/RR is required before finalisation",
        );
      }

      if (!schedule.mrRr.rows.length) {
        throw new BadRequestError("MR/RR does not contain any wagon rows");
      }

      for (const row of schedule.mrRr.rows) {
        if (!row.vpNo?.trim()) {
          throw new BadRequestError(
            `${row.rowLabel} does not have a VP number`,
          );
        }

        if (!row.vpWagonLoading) {
          throw new BadRequestError(
            `${row.rowLabel} does not have a VP wagon loading`,
          );
        }

        if (!["COMPLETED", "VERIFIED"].includes(row.vpWagonLoading.status)) {
          throw new BadRequestError(
            `${row.rowLabel} VP wagon is not marked Loaded`,
          );
        }
      }

      const finalisedAt = new Date();
      const fyCode = fyCodeFor(finalisedAt);
      const sequence = await nextSequence(
        tx,
        schedule.fromBranch.branchCode,
        fyCode,
        "RAIL_RAKE",
      );
      const rakeNumber = [
        "RK",
        schedule.fromBranch.branchCode,
        schedule.toBranch.branchCode,
        fyCode,
        String(sequence).padStart(5, "0"),
      ].join("/");

      const railRake = await tx.railRake.create({
        data: {
          rakeNumber,
          fyCode,
          vpScheduleId: schedule.id,
          fromBranchId: schedule.fromBranchId,
          toBranchId: schedule.toBranchId,
          generatedAt: finalisedAt,
          generatedById: userId,
          remarks: input.remarks ?? null,
        },
        include: {
          fromBranch: { select: branchSelect },
          toBranch: { select: branchSelect },
        },
      });

      const finalisedSchedule = await tx.vPSchedule.update({
        where: {
          id: schedule.id,
          version: schedule.version,
        },
        data: {
          status: "FINALISED",
          finalisedAt,
          finalisedById: userId,
          updatedById: userId,
          version: { increment: 1 },
        },
        select: {
          id: true,
          scheduleNumber: true,
          status: true,
          version: true,
        },
      });

      return {
        railRake,
        schedule: finalisedSchedule,
        alreadyFinalised: false,
      };
    });

    return sendOk(res, result);
  },
);
/*
 * Eligibility depends only on the schedule's branch/area route (see
 * getEligibleGRNsForRow), not on which VP row/wagon is asking — so this is
 * schedule-scoped, not row-scoped. The client picks a VP row, then groups
 * and filters this same list by gate in memory; a gate-locked row (already
 * has a wagon loading assigned to a gate) filters to that gate client-side
 * too. This replaces the old per-row /gates and /gates/:gateNo/grns
 * endpoints, which independently re-ran this same query up to 3 times for
 * one schedule's worth of wagons. Redis-cached per route (see
 * vp-loading.cache.ts) since every wagon in the schedule shares one answer.
 */
router.get(
  "/schedules/:vpScheduleId/eligible-grns",
  can(PERMS.VP_LOADING.VIEW),
  async (req, res) => {
    const vpScheduleId = getIdParam(req.params.vpScheduleId, "VP Schedule");

    const schedule = await db.vPSchedule.findFirst({
      where: {
        id: vpScheduleId,
        deletedAt: null,
        ...branchFilter(req, "fromBranchId"),
      },
      select: {
        fromBranchId: true,
        toBranchId: true,
        sourceAreaId: true,
        destinationAreaId: true,
        mrRr: { select: { status: true } },
      },
    });

    if (!schedule) throw new NotFoundError("VP Schedule not found");
    if (schedule.mrRr?.status !== "SUBMITTED") {
      throw new BadRequestError("MR/RR must be submitted before VP loading");
    }

    const cached = await getCachedEligibleGrns<
      ReturnType<typeof mapGRNDropdown>[]
    >(schedule);

    if (cached) {
      return sendOk(res, cached);
    }

    const grns = (await getEligibleGRNsForRow(readClient, schedule)).map(
      mapGRNDropdown,
    );

    await setCachedEligibleGrns(schedule, grns);

    return sendOk(res, grns);
  },
);
// shwo the Preview AFter selecte GRN(LR) from Dropdown
router.get(
  "/rows/:mrrrRowId/grns/:grnId/preview",
  can(PERMS.VP_LOADING.VIEW),
  async (req, res) => {
    const mrrrRowId = getIdParam(req.params.mrrrRowId, "MR/RR row");

    const grnId = getIdParam(req.params.grnId, "GRN");

    // 1. Get and validate selected MR/RR wagon row
    const row = await getMRRRRowForLoading(readClient, mrrrRowId);

    assertBranchAccess(req, row.mrRr.vpSchedule.fromBranchId);

    // 2. Get and validate selected GRN/LR
    const grn = await getGRNForLoading(readClient, grnId);

    assertGRNCompatibleWithRow(row, grn);

    // 3. Calculate remaining available GRN quantity
    const availableGrn = withAvailability(grn);

    if (availableGrn.availableQty <= 0) {
      throw new BadRequestError("GRN has no available quantity for VP loading");
    }

    // 4. Return paperwork and quantity information
    return sendOk(res, {
      schedule: row.mrRr.vpSchedule,

      mrRrRow: row,

      vpWagonLoading: row.vpWagonLoading,

      currentTotals: {
        loadedQty: row.vpWagonLoading?.totalLoadedQty ?? 0,
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
    const mrrrRowId = getIdParam(req.params.mrrrRowId, "MR/RR row");

    const parsed = createVPLoadingAllocationSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten());
    }

    const input = parsed.data;
    const userId = actorId(req);

    /*
     * These are the larger read-only queries.
     * Run them before opening the transaction.
     */
    const [row, grn] = await Promise.all([
      getMRRRRowForLoading(db, mrrrRowId),

      getGRNForLoading(db, input.grnId),
    ]);

    assertBranchAccess(req, row.mrRr.vpSchedule.fromBranchId);

    await assertLoadingSupervisor(
      readClient,
      input.loadingSupervisorId,
      row.mrRr.vpSchedule.fromBranchId,
    );

    assertGRNCompatibleWithRow(row, grn);

    const grnGateNo = grn.gateNo?.trim();

    if (!grnGateNo) {
      throw new BadRequestError("Selected GRN does not have a gate number");
    }

    const result = await db.$transaction(async (tx) => {
      const existingWagon = await tx.vPWagonLoading.findUnique({
        where: {
          mrRrRowId: mrrrRowId,
        },
        select: {
          id: true,
          status: true,
          gateNo: true,
          version: true,
          labourId: true,
          labourCharge: true,
          loadingSupervisorId: true,
          remarks: true,
          loadingStartedAt: true,
        },
      });

      let wagon: {
        id: string;
        version: number;
      };

      if (existingWagon) {
        if (!["DRAFT", "IN_PROGRESS"].includes(existingWagon.status)) {
          throw new BadRequestError(
            "Only a draft or in-progress wagon can be loaded",
          );
        }

        assertVersion(
          input.wagonVersion,
          existingWagon.version,
          "Wagon loading was updated by someone else",
        );

        const lockedGateNo = existingWagon.gateNo?.trim();

        if (lockedGateNo && lockedGateNo !== grnGateNo) {
          throw new BadRequestError(
            `This wagon is assigned to Gate ${lockedGateNo}. LR from Gate ${grnGateNo} cannot be loaded`,
          );
        }

        wagon = await tx.vPWagonLoading.update({
          where: {
            id: existingWagon.id,
          },
          data: {
            status: "IN_PROGRESS",
            gateNo: lockedGateNo ?? grnGateNo,
            labourId: existingWagon.labourId,
            labourCharge: existingWagon.labourCharge,
            loadingSupervisorId: existingWagon.loadingSupervisorId,
            remarks: input.remarks ?? existingWagon.remarks,
            loadingStartedAt: existingWagon.loadingStartedAt ?? new Date(),
            updatedById: userId,
            version: {
              increment: 1,
            },
          },
          select: {
            id: true,
            version: true,
          },
        });
      } else {
        await tx.vPSchedule.update({
          where: {
            id: row.mrRr.vpSchedule.id,
          },
          data: {
            status: "LOADING",
            updatedById: userId,
            version: {
              increment: 1,
            },
          },
        });

        wagon = await tx.vPWagonLoading.create({
          data: {
            mrRrRowId: row.id,
            status: "IN_PROGRESS",
            gateNo: grnGateNo,
            labourId: input.labourId,
            labourCharge: toMoney(input.labourCharge),
            loadingSupervisorId: input.loadingSupervisorId,
            remarks: input.remarks,
            loadingStartedAt: new Date(),
            wagonCapacityCftSnapshot:
              row.wagon.totalCft === null || row.wagon.totalCft === undefined
                ? null
                : new Prisma.Decimal(row.wagon.totalCft),
            wagonCapacityMtSnapshot:
              row.wagon.capacityMt === null ||
                row.wagon.capacityMt === undefined
                ? null
                : new Prisma.Decimal(row.wagon.capacityMt),
            createdById: userId,
          },
          select: {
            id: true,
            version: true,
          },
        });
      }

      /*
       * Check whether this GRN already has an
       * allocation in the selected wagon.
       */
      const existing = await tx.vPLoading.findUnique({
        where: {
          vpWagonLoadingId_grnId: {
            vpWagonLoadingId: wagon.id,
            grnId: input.grnId,
          },
        },
        select: {
          id: true,
          status: true,

          goods: {
            select: {
              grnGoodsId: true,
              loadedQty: true,
              loadingDamageQty: true,
            },
          },
        },
      });

      const availableGrn = withAvailability(grn, existing?.id);

      /*
       * If the allocation is active, add the new
       * quantities to its existing quantities.
       *
       * If it is cancelled or doesn't exist,
       * use only the submitted quantities.
       */
      const goodsInput =
        existing && existing.status !== "CANCELLED"
          ? mergeVPLoadingGoods(
            existing.goods.map((goods) => ({
              grnGoodsId: goods.grnGoodsId,
              loadedQty: Number(goods.loadedQty ?? 0),
              loadingDamageQty: Number(goods.loadingDamageQty ?? 0),
            })),
            input.goods,
          )
          : input.goods;

      const allocationGoods = buildAllocationGoods(availableGrn, goodsInput);

      let allocation: {
        id: string;
      };

      if (existing) {
        /*
         * Remove the previous goods rows before
         * replacing them with recalculated rows.
         */
        await tx.vPLoadingGoods.deleteMany({
          where: {
            vpLoadingId: existing.id,
          },
        });

        allocation = await tx.vPLoading.update({
          where: {
            id: existing.id,
          },
          data: {
            status: "LOADED",

            loadedQty: allocationGoods.totals.loadedQty,

            remarks: input.remarks,

            // Clear cancellation information
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
        const loadingNumber = await generateVPLoadingNumber(
          tx,
          row.mrRr.vpSchedule.fromBranch.branchCode,
        );

        allocation = await tx.vPLoading.create({
          data: {
            loadingNumber,
            vpWagonLoadingId: wagon.id,
            grnId: input.grnId,
            status: "LOADED",

            loadedQty: allocationGoods.totals.loadedQty,

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

      /*
       * Use the optimized aggregate-based helper.
       * Do not load full wagon details here.
       */
      const updatedWagon = await recalculateVPWagonLoadingTotals(tx, wagon.id, {
        detail: false,
      });

      return {
        allocationId: allocation.id,
        vpWagonLoadingId: wagon.id,
        wagonVersion: updatedWagon.version,
      };
    });

    // Allocating against a GRN changes its available quantity for every
    // other wagon in this schedule's route — bust the shared cache.
    await invalidateEligibleGrns(row.mrRr.vpSchedule);

    /*
     * Fetch the complete response only after
     * the transaction has committed.
     */
    const created = await db.vPLoading.findUnique({
      where: {
        id: result.allocationId,
      },
      include: allocationInclude,
    });

    if (!created) {
      throw new NotFoundError("VP loading allocation not found");
    }

    return sendOk(
      res,
      {
        allocation: created,
        vpWagonLoadingId: result.vpWagonLoadingId,
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

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten());
    }

    const input = parsed.data;
    const userId = actorId(req);

    await db.$transaction(async (tx) => {
      // Only select fields required for validation/update
      const existing = await tx.vPLoading.findUnique({
        where: {
          id: allocationId,
        },
        select: {
          id: true,
          status: true,
          version: true,
          grnId: true,
          vpWagonLoadingId: true,

          vpWagonLoading: {
            select: {
              id: true,
              status: true,
              mrRrRowId: true,

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

      if (!existing) {
        throw new NotFoundError("VP loading allocation not found");
      }

      assertBranchAccess(
        req,
        existing.vpWagonLoading.mrRrRow.mrRr.vpSchedule.fromBranchId,
      );

      if (existing.status !== "LOADED") {
        throw new BadRequestError(
          "Only an active loaded allocation can be updated",
        );
      }

      if (
        !["IN_PROGRESS", "COMPLETED"].includes(existing.vpWagonLoading.status)
      ) {
        throw new BadRequestError(
          "Only an in-progress or loaded wagon can be updated",
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
        { allowCompleted: true },
      );

      const grn = await getCurrentGRNAvailability(
        tx,
        existing.grnId,
      );

      assertGRNCompatibleWithRow(row, grn);

      // Exclude this allocation's current quantities
      const availableGrn = withAvailability(grn, existing.id);

      const allocationGoods = buildAllocationGoods(availableGrn, input.goods);

      await tx.vPLoadingGoods.deleteMany({
        where: {
          vpLoadingId: existing.id,
        },
      });

      await tx.vPLoading.update({
        where: {
          id: existing.id,
          version: existing.version,
        },
        data: {
          loadedQty: allocationGoods.totals.loadedQty,
          remarks: input.remarks,
          updatedById: userId,

          version: {
            increment: 1,
          },

          goods: {
            create: allocationGoods.rows,
          },
        },
      });

      await recalculateVPWagonLoadingTotals(tx, existing.vpWagonLoadingId, {
        detail: false,
      });
    }, VP_LOADING_TX_BUDGET);

    // Large response query runs after transaction commits
    const updated = await db.vPLoading.findUnique({
      where: {
        id: allocationId,
      },
      include: allocationInclude,
    });

    if (!updated) {
      throw new NotFoundError("Updated VP loading allocation not found");
    }

    // Loaded quantities changed — bust the shared eligibility cache for
    // this schedule's route.
    await invalidateEligibleGrns(
      updated.vpWagonLoading.mrRrRow.mrRr.vpSchedule,
    );

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

    const parsed = cancelVPLoadingSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten());
    }

    const userId = actorId(req);

    /*
     * Read branch before mutation if branch validation
     * is not performed inside the transaction service.
     */
    const allocation = await db.vPLoading.findUnique({
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
      throw new NotFoundError("VP loading allocation not found");
    }

    assertBranchAccess(
      req,
      allocation.vpWagonLoading.mrRrRow.mrRr.vpSchedule.fromBranchId,
    );

    const result = await db.$transaction((tx) =>
      cancelVPLoadingAllocation(tx, {
        allocationId,
        actorId: userId,
        version: parsed.data.version,
        reason: parsed.data.reason,
      }),
    );

    const cancelled = await db.vPLoading.findUnique({
      where: {
        id: result.allocationId,
      },
      include: allocationInclude,
    });

    if (!cancelled) {
      throw new NotFoundError("Cancelled allocation not found");
    }

    // Cancelling frees up the GRN's quantity again — bust the shared cache.
    await invalidateEligibleGrns(
      cancelled.vpWagonLoading.mrRrRow.mrRr.vpSchedule,
    );

    return sendOk(res, {
      allocation: cancelled,
      vpWagonLoadingId: result.vpWagonLoadingId,
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
    await getWagonLoadingForReq(req, vpWagonLoadingId);

    /*
     * 1. Get allocations belonging to the
     * selected wagon.
     *
     * Cancelled allocations are also returned
     * because they are part of loading history.
     */
    const allocations = await db.vPLoading.findMany({
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
      ...new Set(allocations.map((allocation) => allocation.grnId)),
    ];

    /*
     * FIX: steps 2, 3, and 4 below are independent of each other — none of
     * them uses another's result, they only need `grnIds` (and, for step 4,
     * req.ctx / vpWagonLoadingId, both already known). Previously these ran
     * as three separate sequential `await`s, so the server waited for each
     * one to fully finish before starting the next. That serial chain was
     * the main reason this endpoint took 4-7 seconds. Running them together
     * with Promise.all cuts the wait to roughly the slowest of the three
     * instead of the sum of all three.
     */
    const relatedBranchWhere: Prisma.VPLoadingWhereInput =
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

    const [grns, activeTotals, otherAllocations] = await Promise.all([
      /*
       * 2. Get total received quantity for
       * every selected GRN.
       */
      db.gRN.findMany({
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
      }),

      /*
       * 3. Calculate total active loaded
       * quantity across every wagon.
       *
       * This query is not branch-filtered because
       * availability must consider every active
       * allocation. It only returns totals and
       * does not expose another branch's details.
       */
      db.vPLoading.groupBy({
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
      }),

      /*
       * 4. Find active allocations for the
       * same GRNs in other accessible wagons.
       */
      db.vPLoading.findMany({
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
                          scheduleNumber: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const totalReceivedByGrn = new Map(
      grns.map((grn) => [
        grn.id,

        grn.goods.reduce(
          (sum, goods) => sum + Number(goods.receivedQty ?? 0),
          0,
        ),
      ]),
    );

    const totalLoadedByGrn = new Map(
      activeTotals.map((row) => [row.grnId, Number(row._sum.loadedQty ?? 0)]),
    );

    /*
     * Group other-wagon records by GRN.
     */
    const otherWagonsByGrn = new Map<
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

    for (const allocation of otherAllocations) {
      const loading = allocation.vpWagonLoading;

      const row = loading.mrRrRow;
      const schedule = row.mrRr.vpSchedule;

      const current = otherWagonsByGrn.get(allocation.grnId) ?? [];

      current.push({
        allocationId: allocation.id,

        vpWagonLoadingId: loading.id,

        scheduleId: schedule.id,

        scheduleNumber: schedule.scheduleNumber,

        mrrrRowId: row.id,

        vpNo: row.vpNo ?? row.rowLabel ?? null,

        wagonId: row.wagon?.id ?? null,
        wagonName: row.wagon?.name ?? null,

        gateNo: loading.gateNo ?? null,

        loadedQty: Number(allocation.loadedQty),

        status: loading.status,
      });

      otherWagonsByGrn.set(allocation.grnId, current);
    }

    /*
     * 5. Return current allocations with
     * quantity and split-wagon information.
     */
    const response = allocations.map((allocation) => {
      const totalReceivedQty = totalReceivedByGrn.get(allocation.grnId) ?? 0;

      const totalLoadedQty = totalLoadedByGrn.get(allocation.grnId) ?? 0;

      /*
       * A cancelled allocation does not
       * contribute to current loading.
       */
      const loadedInCurrentWagon =
        allocation.status === "CANCELLED" ? 0 : Number(allocation.loadedQty);

      const loadedInOtherWagons = Math.max(
        totalLoadedQty - loadedInCurrentWagon,
        0,
      );

      const availableQty = Math.max(totalReceivedQty - totalLoadedQty, 0);

      return {
        ...allocation,

        quantitySummary: {
          totalReceivedQty,

          loadedInCurrentWagon,

          loadedInOtherWagons,

          totalLoadedQty,

          availableQty,
        },

        otherWagons: otherWagonsByGrn.get(allocation.grnId) ?? [],
      };
    });

    return sendOk(res, response);
  },
);

router.patch(
  "/wagons/:vpWagonLoadingId/labour",
  can(PERMS.VP_LOADING.UPDATE),
  async (req, res) => {
    const vpWagonLoadingId = getIdParam(
      req.params.vpWagonLoadingId,
      "VP wagon loading",
    );

    const parsed = updateVPWagonLoadingLabourSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten());
    }

    const userId = actorId(req);

    await db.$transaction(async (tx) => {
      // Fetch only fields required for validation
      const current = await tx.vPWagonLoading.findUnique({
        where: {
          id: vpWagonLoadingId,
        },
        select: {
          id: true,
          status: true,
          version: true,

          mrRrRow: {
            select: {
              mrRr: {
                select: {
                  vpSchedule: {
                    select: {
                      fromBranchId: true,
                      status: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!current) {
        throw new NotFoundError("VP wagon loading not found");
      }

      assertBranchAccess(req, current.mrRrRow.mrRr.vpSchedule.fromBranchId);

      if (current.mrRrRow.mrRr.vpSchedule.status === "FINALISED") {
        throw new BadRequestError("A finalised VP Schedule cannot be changed");
      }

      await assertLoadingSupervisor(
        tx,
        parsed.data.loadingSupervisorId,
        current.mrRrRow.mrRr.vpSchedule.fromBranchId,
      );

      if (!["IN_PROGRESS", "COMPLETED"].includes(current.status)) {
        throw new BadRequestError(
          "Only an in-progress or loaded wagon labour can be updated",
        );
      }

      assertVersion(
        parsed.data.version,
        current.version,
        "Wagon loading changed. Please refresh.",
      );

      await tx.vPWagonLoading.update({
        where: {
          id: current.id,
          version: current.version,
        },
        data: {
          labourId: parsed.data.labourId ?? null,

          labourCharge:
            parsed.data.labourCharge === undefined
              ? null
              : BigInt(Math.round(parsed.data.labourCharge * 100)),

          loadingSupervisorId: parsed.data.loadingSupervisorId ?? null,

          remarks: parsed.data.remarks,
          updatedById: userId,

          version: {
            increment: 1,
          },
        },
      });
    });

    // Load the complete updated data outside the transaction
    const updated = await db.vPWagonLoading.findUnique({
      where: {
        id: vpWagonLoadingId,
      },
      include: vpWagonLoadingInclude,
    });

    if (!updated) {
      throw new NotFoundError("VP wagon loading not found");
    }

    return sendOk(res, updated);
  },
);

router.post(
  "/wagons/:vpWagonLoadingId/complete",
  canAny(PERMS.VP_LOADING.MARK_LOADED, PERMS.VP_LOADING.COMPLETE),
  async (req, res) => {
    const vpWagonLoadingId = getIdParam(
      req.params.vpWagonLoadingId,
      "VP wagon loading",
    );

    const parsed = completeVPWagonLoadingSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten());
    }

    const userId = actorId(req);

    await db.$transaction(async (tx) => {
      // Fetch only the fields required inside the transaction
      const current = await tx.vPWagonLoading.findUnique({
        where: {
          id: vpWagonLoadingId,
        },
        select: {
          id: true,
          status: true,
          version: true,
          loadingCompletedAt: true,

          allocations: {
            select: {
              status: true,
            },
          },

          mrRrRow: {
            select: {
              mrRr: {
                select: {
                  vpScheduleId: true,

                  vpSchedule: {
                    select: {
                      fromBranchId: true,
                      status: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!current) {
        throw new NotFoundError("VP wagon loading not found");
      }

      assertBranchAccess(req, current.mrRrRow.mrRr.vpSchedule.fromBranchId);

      if (current.mrRrRow.mrRr.vpSchedule.status === "FINALISED") {
        throw new BadRequestError("A finalised VP Schedule cannot be changed");
      }

      const markLoaded = parsed.data.loaded;

      if (markLoaded && current.status !== "IN_PROGRESS") {
        throw new BadRequestError(
          "Only an in-progress wagon can be marked loaded",
        );
      }
      if (!markLoaded && current.status !== "COMPLETED") {
        throw new BadRequestError("Only a loaded wagon can be reopened");
      }

      assertVersion(
        parsed.data.version,
        current.version,
        "Wagon loading changed. Please refresh.",
      );

      if (markLoaded) {
        const activeAllocations = current.allocations.filter(
          (allocation) => allocation.status !== "CANCELLED",
        );

        if (!activeAllocations.length) {
          throw new BadRequestError(
            "At least one loaded allocation is required",
          );
        }

        if (
          activeAllocations.some((allocation) => allocation.status !== "LOADED")
        ) {
          throw new BadRequestError("All active allocations must be loaded");
        }
      }

      await tx.vPWagonLoading.update({
        where: {
          id: current.id,
        },
        data: {
          status: markLoaded ? "COMPLETED" : "IN_PROGRESS",
          loadingCompletedAt: markLoaded
            ? (current.loadingCompletedAt ?? new Date())
            : null,
          updatedById: userId,
          version: {
            increment: 1,
          },
        },
      });

      // Keep this call, but use the optimized helper
      await recalculateVpScheduleLoadingStatus(
        tx,
        current.mrRrRow.mrRr.vpScheduleId,
        userId,
      );
    });

    // Fetch complete response after the transaction finishes
    const completed = await db.vPWagonLoading.findUnique({
      where: {
        id: vpWagonLoadingId,
      },
      include: vpWagonLoadingInclude,
    });

    if (!completed) {
      throw new NotFoundError("VP wagon loading not found");
    }

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

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten());
    }

    const userId = actorId(req);

    await db.$transaction(async (tx) => {
      // Fetch only fields required for validation
      const current = await tx.vPWagonLoading.findUnique({
        where: {
          id: vpWagonLoadingId,
        },
        select: {
          id: true,
          status: true,
          version: true,

          allocations: {
            select: {
              status: true,
            },
          },

          mrRrRow: {
            select: {
              mrRr: {
                select: {
                  vpScheduleId: true,

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
      });

      if (!current) {
        throw new NotFoundError("VP wagon loading not found");
      }

      assertBranchAccess(req, current.mrRrRow.mrRr.vpSchedule.fromBranchId);

      if (current.status === "VERIFIED") {
        throw new BadRequestError("Verified wagon cannot be cancelled");
      }

      if (current.status === "CANCELLED") {
        throw new BadRequestError("Wagon is already cancelled");
      }

      const hasActiveAllocations = current.allocations.some(
        (allocation) => allocation.status !== "CANCELLED",
      );

      if (hasActiveAllocations) {
        throw new BadRequestError(
          "Cancel active allocations before cancelling wagon",
        );
      }

      assertVersion(
        parsed.data.version,
        current.version,
        "Wagon loading changed. Please refresh.",
      );

      await tx.vPWagonLoading.update({
        where: {
          id: current.id,
          version: current.version,
        },
        data: {
          status: "CANCELLED",
          cancelReason: parsed.data.reason,
          cancelledById: userId,
          cancelledAt: new Date(),
          updatedById: userId,
          version: {
            increment: 1,
          },
        },
      });

      await recalculateVpScheduleLoadingStatus(
        tx,
        current.mrRrRow.mrRr.vpScheduleId,
        userId,
      );
    });

    // Fetch complete response outside the transaction
    const cancelled = await db.vPWagonLoading.findUnique({
      where: {
        id: vpWagonLoadingId,
      },
      include: vpWagonLoadingInclude,
    });

    if (!cancelled) {
      throw new NotFoundError("VP wagon loading not found");
    }

    return sendOk(res, cancelled);
  },
);
export default router;
