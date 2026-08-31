import { Router } from "express";
import type { Request } from "express";
import { PERMS } from "@skerp/types";

import { db } from "../../../prisma/prisma.js";
import type {
  Prisma,
  RailRakeStatus,
} from "../../../generated/prisma/index.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can, canAny } from "../../auth/can.middleware.js";
import { BadRequestError, NotFoundError } from "../../lib/error.js";
import { parseListQuery } from "../_shared/list.query.js";
import { sendOk } from "../_shared/response.js";
import {
  branchSelect,
  customerSelect,
  userSelect,
} from "../vp-loading/vp-loading.service.js";

const router: Router = Router();
router.use(authMiddleware);

const rakeStatuses = new Set<RailRakeStatus>([
  "CREATED",
  "DISPATCHED",
  "UNLOADING",
  "RECEIVED",
]);

const getIdParam = (value: string | string[] | undefined, label: string) => {
  const id = decodeURIComponent(
    Array.isArray(value) ? (value[0] ?? "") : (value ?? ""),
  ).trim();

  if (!id) throw new BadRequestError(`${label} is required`);
  return id;
};

/** A rake is visible to users assigned to either its origin or destination. */
const rakeBranchFilter = (req: Request): Prisma.RailRakeWhereInput => {
  if (!req.ctx || req.ctx.branchScope === "ALL") return {};
  if (!req.ctx.branchIds.length) return { id: { in: [] } };

  return {
    OR: [
      { fromBranchId: { in: req.ctx.branchIds } },
      { toBranchId: { in: req.ctx.branchIds } },
    ],
  };
};

const rakeListSelect = {
  id: true,
  rakeNumber: true,
  railwayRakeNumber: true,
  fyCode: true,
  status: true,
  generatedAt: true,
  expectedArrivalAt: true,
  dispatchedAt: true,
  unloadingStartedAt: true,
  receivedAt: true,
  version: true,
  fromBranch: { select: branchSelect },
  toBranch: { select: branchSelect },
  vpSchedule: {
    select: {
      id: true,
      scheduleNumber: true,
      scheduleDate: true,
      scheduleName: true,
      status: true,
    },
  },
  _count: { select: { branchGrns: true } },
} satisfies Prisma.RailRakeSelect;

const getDestinationRake = async (req: Request, identifier: string) => {
  const rake = await db.railRake.findFirst({
    where: {
      OR: [{ id: identifier }, { rakeNumber: identifier }],
      ...(req.ctx?.branchScope === "ALL"
        ? {}
        : { toBranchId: { in: req.ctx?.branchIds ?? [] } }),
    },
    select: {
      id: true,
      rakeNumber: true,
      status: true,
      toBranchId: true,
      version: true,
      vpScheduleId: true,
    },
  });

  if (!rake) throw new NotFoundError("Rail Rake not found");
  return rake;
};

router.get("/", can(PERMS.VP_LOADING.VIEW), async (req, res) => {
  const query = parseListQuery(req);
  const status = query.filter.status?.toUpperCase();
  if (status && !rakeStatuses.has(status as RailRakeStatus)) {
    throw new BadRequestError("Invalid Rail Rake status");
  }

  const searchFilter: Prisma.RailRakeWhereInput = query.search
    ? {
      OR: [
        {
          rakeNumber: {
            contains: query.search,
            mode: "insensitive",
          },
        },
        {
          railwayRakeNumber: {
            contains: query.search,
            mode: "insensitive",
          },
        },
        {
          vpSchedule: {
            scheduleNumber: {
              contains: query.search,
              mode: "insensitive",
            },
          },
        },
      ],
    }
    : {};

  const where: Prisma.RailRakeWhereInput = {
    ...(status ? { status: status as RailRakeStatus } : {}),
    AND: [rakeBranchFilter(req), searchFilter],
  };

  const allowedSortFields = new Set([
    "rakeNumber",
    "status",
    "generatedAt",
    "dispatchedAt",
    "expectedArrivalAt",
    "createdAt",
  ]);
  const orderBy: Prisma.RailRakeOrderByWithRelationInput =
    query.sort && allowedSortFields.has(query.sort.field)
      ? { [query.sort.field]: query.sort.direction }
      : { generatedAt: "desc" };

  const [rakes, total] = await Promise.all([
    db.railRake.findMany({
      where,
      select: rakeListSelect,
      skip: query.page * query.size,
      take: query.size,
      orderBy,
    }),
    db.railRake.count({ where }),
  ]);

  return sendOk(res, rakes, {
    page: query.page,
    size: query.size,
    total,
  });
});

/** Destination worklist. Static route must remain before /:rakeId. */
router.get(
  "/incoming",
  canAny(PERMS.VP_LOADING.VIEW, PERMS.RAIL_BRANCH_GRN.CREATE),
  async (req, res) => {
    const rakes = await db.railRake.findMany({
      where: {
        status: {
          in: ["CREATED", "DISPATCHED", "UNLOADING"],
        },

        ...(req.ctx?.branchScope === "ALL"
          ? {}
          : {
            toBranchId: {
              in: req.ctx?.branchIds ?? [],
            },
          }),
      },

      select: {
        ...rakeListSelect,
        vpScheduleId: true,
      },

      orderBy: [
        { expectedArrivalAt: "asc" },
        { dispatchedAt: "asc" },
      ],

      take: 500,
    });

    if (!rakes.length) {
      return sendOk(res, []);
    }

    /*
     * Find completed/verified VPs that still do not have
     * any Branch GRN.
     */
    const pendingVpLoadings = await db.vPWagonLoading.findMany({
      where: {
        status: {
          in: ["COMPLETED", "VERIFIED"],
        },

        branchGrn: {
          is: null,
        },

        mrRrRow: {
          mrRr: {
            vpScheduleId: {
              in: rakes.map((rake) => rake.vpScheduleId),
            },
          },
        },
      },

      select: {
        mrRrRow: {
          select: {
            mrRr: {
              select: {
                vpScheduleId: true,
              },
            },
          },
        },
      },
    });

    const scheduleIdsWithPendingVp = new Set(
      pendingVpLoadings.map(
        (loading) => loading.mrRrRow.mrRr.vpScheduleId,
      ),
    );

    const rakesWithPendingGrn = rakes.filter((rake) =>
      scheduleIdsWithPendingVp.has(rake.vpScheduleId),
    );

    return sendOk(res, rakesWithPendingGrn);
  },
);

router.get(
  "/:rakeId/available-vps",
  canAny(PERMS.VP_LOADING.VIEW, PERMS.RAIL_BRANCH_GRN.CREATE),
  async (req, res) => {
    const rakeId = getIdParam(req.params.rakeId, "Rail Rake");
    const rake = await getDestinationRake(req, rakeId);

    if (!["CREATED", "DISPATCHED", "UNLOADING"].includes(rake.status)) {
      throw new BadRequestError(
        "VPs are unavailable after the rake has been fully received",
      );
    }

    const loadings = await db.vPWagonLoading.findMany({
      where: {
        status: { in: ["COMPLETED", "VERIFIED"] },
        branchGrn: null,
        mrRrRow: {
          mrRr: {
            vpScheduleId: rake.vpScheduleId,
          },
        },
      },
      select: {
        id: true,
        status: true,
        totalLoadedQty: true,
        verifiedAt: true,
        mrRrRow: {
          select: {
            id: true,
            rowNumber: true,
            rowLabel: true,
            vpNo: true,
            mrRrNo: true,
            sealNo: true,
            wagon: {
              select: {
                id: true,
                name: true,
                totalCft: true,
                capacityMt: true,
              },
            },
          },
        },
        _count: {
          select: {
            allocations: {
              where: { status: "LOADED" },
            },
          },
        },
      },
      orderBy: { mrRrRow: { rowNumber: "asc" } },
    });

    return sendOk(
      res,
      loadings.map((loading) => ({
        value: loading.id,
        vpWagonLoadingId: loading.id,
        vpNo: loading.mrRrRow.vpNo,
        row: loading.mrRrRow,
        status: loading.status,
        totalLoadedQty: loading.totalLoadedQty,
        verifiedAt: loading.verifiedAt,
        allocationCount: loading._count.allocations,
      })),
    );
  },
);

router.get(
  "/:rakeId/vps/:vpWagonLoadingId/preview",
  can(PERMS.VP_LOADING.VIEW),
  async (req, res) => {
    const rakeId = getIdParam(req.params.rakeId, "Rail Rake");
    const vpWagonLoadingId = getIdParam(
      req.params.vpWagonLoadingId,
      "VP wagon loading",
    );
    const rake = await getDestinationRake(req, rakeId);

    if (!["CREATED", "DISPATCHED", "UNLOADING"].includes(rake.status)) {
      throw new BadRequestError(
        "Rake goods are unavailable after the rake has been fully received",
      );
    }

    const loading = await db.vPWagonLoading.findFirst({
      where: {
        id: vpWagonLoadingId,
        status: { in: ["COMPLETED", "VERIFIED"] },
        branchGrn: null,
        mrRrRow: { mrRr: { vpScheduleId: rake.vpScheduleId } },
      },
      select: {
        id: true,
        status: true,
        gateNo: true,
        totalLoadedQty: true,
        totalLoadedCft: true,
        totalLoadedWeightMt: true,
        verifiedAt: true,
        version: true,
        mrRrRow: {
          select: {
            id: true,
            rowNumber: true,
            rowLabel: true,
            vpNo: true,
            mrRrNo: true,
            sealNo: true,
            wagonTypeLabel: true,
            wagon: true,
          },
        },
        allocations: {
          where: { status: "LOADED" },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            loadingNumber: true,
            loadedQty: true,
            grn: {
              select: {
                id: true,
                grnNumber: true,
                lorryReceipt: {
                  select: {
                    id: true,
                    lrNumber: true,
                    group: {
                      select: {
                        consignor: { select: customerSelect },
                        consignee: { select: customerSelect },
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
                loadedQty: true,
                loadingDamageQty: true,
                loadedWeightMt: true,
                loadedCft: true,
                remarks: true,
                grnGoods: {
                  select: {
                    id: true,
                    goodsName: true,
                    description: true,
                    unit: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!loading) {
      throw new NotFoundError(
        "Loaded VP wagon is unavailable or already has a Branch GRN",
      );
    }

    const goods = loading.allocations.flatMap((allocation) =>
      allocation.goods.map((item) => ({
        vpLoadingGoodsId: item.id,
        vpLoadingId: allocation.id,
        loadingNumber: allocation.loadingNumber,
        grnId: allocation.grn.id,
        grnNumber: allocation.grn.grnNumber,
        lrId: allocation.grn.lorryReceipt.id,
        lrNumber: allocation.grn.lorryReceipt.lrNumber,
        consignor: allocation.grn.lorryReceipt.group.consignor,
        consignee: allocation.grn.lorryReceipt.group.consignee,
        goods: item.grnGoods,
        loadedQty: item.loadedQty,
        loadingDamageQty: item.loadingDamageQty,
        loadedWeightMt: item.loadedWeightMt,
        loadedCft: item.loadedCft,
        remarks: item.remarks,
      })),
    );

    return sendOk(res, {
      rake: {
        id: rake.id,
        rakeNumber: rake.rakeNumber,
        status: rake.status,
      },
      vpWagonLoading: {
        ...loading,
        allocations: undefined,
      },
      goods,
      summary: {
        sourceLineCount: goods.length,
        totalLoadedQty: goods.reduce(
          (total, item) => total + item.loadedQty,
          0,
        ),
        totalLoadingDamageQty: goods.reduce(
          (total, item) => total + item.loadingDamageQty,
          0,
        ),
      },
    });
  },
);

/** Detail route remains last so it cannot swallow the static subpaths above. */
router.get("/:rakeId", can(PERMS.VP_LOADING.VIEW), async (req, res) => {
  const rakeId = getIdParam(req.params.rakeId, "Rail Rake");
  const rake = await db.railRake.findFirst({
    where: {
      AND: [
        rakeBranchFilter(req),
        { OR: [{ id: rakeId }, { rakeNumber: rakeId }] },
      ],
    },
    include: {
      fromBranch: { select: branchSelect },
      toBranch: { select: branchSelect },
      generatedBy: { select: userSelect },
      dispatchedBy: { select: userSelect },
      vpSchedule: {
        include: {
          sourceArea: {
            select: { id: true, name: true },
          },
          destinationArea: {
            select: { id: true, name: true },
          },
          mrRr: {
            select: {
              id: true,
              mrRrNumber: true,
              status: true,
              rakeType: true,
              rows: {
                orderBy: { rowNumber: "asc" },
                select: {
                  id: true,
                  rowNumber: true,
                  rowLabel: true,
                  vpNo: true,
                  mrRrNo: true,
                  sealNo: true,
                  wagonTypeLabel: true,
                  wagon: true,
                  vpWagonLoading: {
                    select: {
                      id: true,
                      status: true,
                      gateNo: true,
                      totalLoadedQty: true,
                      totalLoadedCft: true,
                      totalLoadedWeightMt: true,
                      verifiedAt: true,
                      branchGrn: {
                        select: {
                          id: true,
                          status: true,
                          totalLoadedQty: true,
                          totalReceivedQty: true,
                          totalDamageQty: true,
                          totalShortageQty: true,
                          submittedAt: true,
                        },
                      },
                      _count: {
                        select: {
                          allocations: {
                            where: { status: "LOADED" },
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
      branchGrns: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          vpWagonLoadingId: true,
          status: true,
          totalLoadedQty: true,
          totalReceivedQty: true,
          totalDamageQty: true,
          totalShortageQty: true,
          createdAt: true,
          submittedAt: true,
        },
      },
    },
  });

  if (!rake) throw new NotFoundError("Rail Rake not found");

  const rows = rake.vpSchedule.mrRr?.rows ?? [];
  return sendOk(res, {
    ...rake,
    summary: {
      totalWagons: rows.length,
      verifiedWagons: rows.filter(
        (row) => row.vpWagonLoading?.status === "VERIFIED",
      ).length,
      branchGrnsStarted: rake.branchGrns.length,
      branchGrnsSubmitted: rake.branchGrns.filter(
        (grn) => grn.status === "SUBMITTED",
      ).length,
      totalLoadedQty: rows.reduce(
        (total, row) => total + (row.vpWagonLoading?.totalLoadedQty ?? 0),
        0,
      ),
    },
  });
});

export default router;
