import { Router } from "express";
import { Prisma } from "../../../generated/prisma/index.js";
import {
  createVPScheduleSchema,
  updateVPScheduleSchema,
  confirmVPScheduleSchema,
  cancelVPScheduleSchema,
} from "@skerp/validators";
import { PERMS } from "@skerp/types";
import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { assertBranchAccess, branchFilter } from "../../auth/branch-scope.js";
import { parseListQuery } from "../_shared/list.query.js";
import { sendOk } from "../_shared/response.js";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../lib/error.js";

import {
  assertVPScheduleBranchAreaAlignment,
  assertVPScheduleFreightMatrices,
  assertVPScheduleReferences,
  calculateVPScheduleTotals,
  generateVPScheduleNumber,
  vpScheduleInclude,
  vpScheduleListSelect,
} from "./vp-schedule.service.js";

const router: Router = Router();

router.use(authMiddleware);

export const getDateRange = (value: string | Date) => {
  const start = new Date(value);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
};

const actorId = (req: { user?: { userId: string } }) => req.user!.userId;
const readClient = db as unknown as Prisma.TransactionClient;

const getVPScheduleIdentifier = (req: { params: { id?: string } }) => {
  const identifier = decodeURIComponent(req.params.id ?? "").trim();

  if (!identifier) {
    throw new BadRequestError("VP Schedule identifier is required");
  }

  return identifier;
};

const vpScheduleWhereByIdentifier = (identifier: string) => ({
  deletedAt: null,
  OR: [{ id: identifier }, { scheduleNumber: identifier }],
});

const buildWagonCountRows = async (
  tx: Prisma.TransactionClient,
  data: {
    sourceAreaId: string;
    destinationAreaId: string;
    wagonCounts: {
      wagonId: string;
      count: number;
    }[];
  },
) => {
  const sourceArea = await tx.area.findUnique({
    where: { id: data.sourceAreaId },
    select: {
      id: true,
      cityId: true,
    },
  });

  const destinationArea = await tx.area.findUnique({
    where: { id: data.destinationAreaId },
    select: {
      id: true,
      cityId: true,
    },
  });

  if (!sourceArea) {
    throw new BadRequestError("Source area not found");
  }

  if (!destinationArea) {
    throw new BadRequestError("Destination area not found");
  }

  const wagonIds = data.wagonCounts.map((item) => item.wagonId);

  const wagons = await tx.wagon.findMany({
    where: {
      id: {
        in: wagonIds,
      },
    },
    select: {
      id: true,
      totalCft: true,
      capacityMt: true,
    },
  });

  const freightMatrices = await tx.railwayFreightMatrix.findMany({
    where: {
      wagonId: {
        in: wagonIds,
      },
      sourceCityId: sourceArea.cityId,
      destinationCityId: destinationArea.cityId,
      OR: [
        {
          sourceAreaId: sourceArea.id,
          destinationAreaId: destinationArea.id,
        },
        {
          sourceAreaId: sourceArea.id,
          destinationAreaId: null,
        },
        {
          sourceAreaId: null,
          destinationAreaId: destinationArea.id,
        },
        {
          sourceAreaId: null,
          destinationAreaId: null,
        },
      ],
    },
    select: {
      id: true,
      wagonId: true,
      sourceAreaId: true,
      destinationAreaId: true,
      freightAmount: true,
    },
  });

  const wagonMap = new Map(wagons.map((wagon) => [wagon.id, wagon]));

  const findBestFreightMatrix = (wagonId: string) => {
    const matches = freightMatrices.filter(
      (matrix) => matrix.wagonId === wagonId,
    );

    return (
      matches.find(
        (matrix) =>
          matrix.sourceAreaId === sourceArea.id &&
          matrix.destinationAreaId === destinationArea.id,
      ) ??
      matches.find(
        (matrix) =>
          matrix.sourceAreaId === sourceArea.id &&
          matrix.destinationAreaId === null,
      ) ??
      matches.find(
        (matrix) =>
          matrix.sourceAreaId === null &&
          matrix.destinationAreaId === destinationArea.id,
      ) ??
      matches.find(
        (matrix) =>
          matrix.sourceAreaId === null && matrix.destinationAreaId === null,
      ) ??
      null
    );
  };

  return data.wagonCounts.map((item) => {
    const wagon = wagonMap.get(item.wagonId);

    if (!wagon) {
      throw new BadRequestError("Selected wagon not found");
    }

    const freightMatrix = findBestFreightMatrix(item.wagonId);

    if (!freightMatrix) {
      throw new BadRequestError("Railway freight not found for selected wagon");
    }

    const capacityCft = Number(wagon.totalCft ?? 0);
    const capacityMt = Number(wagon.capacityMt ?? 0);

    return {
      wagonId: item.wagonId,
      count: item.count,

      capacityCft,
      capacityMt,
      totalCft: capacityCft * item.count,
      totalMt: capacityMt * item.count,

      freightMatrixId: freightMatrix.id,
      freightAmount: freightMatrix.freightAmount,
      totalFreight: freightMatrix.freightAmount * BigInt(item.count),
    };
  });
};
/* ------------------------------------------------------------------ */
/* List                                                               */
/* ------------------------------------------------------------------ */

router.get("/", can(PERMS.VP_SCHEDULE.VIEW), async (req, res) => {
  const query = parseListQuery(req);

  const where: Prisma.VPScheduleWhereInput = {
    deletedAt: null,
    ...branchFilter(req, "fromBranchId"),
    ...(query.filter.status ? { status: query.filter.status as any } : {}),
    ...(query.search
      ? {
          OR: [
            {
              scheduleNumber: {
                contains: query.search,
                mode: "insensitive",
              },
            },
            {
              scheduleName: {
                contains: query.search,
                mode: "insensitive",
              },
            },
            {
              fromBranch: {
                name: {
                  contains: query.search,
                  mode: "insensitive",
                },
              },
            },
            {
              toBranch: {
                name: {
                  contains: query.search,
                  mode: "insensitive",
                },
              },
            },
            {
              sourceArea: {
                name: {
                  contains: query.search,
                  mode: "insensitive",
                },
              },
            },
            {
              destinationArea: {
                name: {
                  contains: query.search,
                  mode: "insensitive",
                },
              },
            },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    db.vPSchedule.findMany({
      where,
      skip: query.page * query.size,
      take: query.size,
      select: vpScheduleListSelect,
      orderBy: query.sort
        ? { [query.sort.field]: query.sort.direction }
        : { createdAt: "desc" },
    }),

    db.vPSchedule.count({
      where,
    }),
  ]);

  return sendOk(res, data, {
    page: query.page,
    size: query.size,
    total,
  });
});

/* ------------------------------------------------------------------ */
/* Status Counts                                                      */
/* ------------------------------------------------------------------ */

router.get("/status-counts", can(PERMS.VP_SCHEDULE.VIEW), async (req, res) => {
  const base: Prisma.VPScheduleWhereInput = {
    deletedAt: null,
    ...branchFilter(req, "fromBranchId"),
  };

  const grouped = await db.vPSchedule.groupBy({
    by: ["status"],
    where: base,
    _count: {
      _all: true,
    },
  });

  const counts: Record<string, number> = {};
  let all = 0;

  for (const item of grouped) {
    counts[item.status] = item._count._all;
    all += item._count._all;
  }

  counts.ALL = all;

  return sendOk(res, counts);
});

/* ------------------------------------------------------------------ */
/* Detail                                                             */
/* ------------------------------------------------------------------ */

router.get("/:id", can(PERMS.VP_SCHEDULE.VIEW), async (req, res) => {
  const identifier = getVPScheduleIdentifier(req);

  const schedule = await db.vPSchedule.findFirst({
    where: vpScheduleWhereByIdentifier(identifier),
    include: vpScheduleInclude,
  });

  if (!schedule) {
    throw new NotFoundError("VP Schedule not found");
  }

  assertBranchAccess(req, schedule.fromBranchId);

  return sendOk(res, schedule);
});

/* ------------------------------------------------------------------ */
/* Create -> DRAFT                                                    */
/* ------------------------------------------------------------------ */

router.post("/", can(PERMS.VP_SCHEDULE.CREATE), async (req, res) => {
  const parsed = createVPScheduleSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }

const data = parsed.data;

assertBranchAccess(req, data.fromBranchId);

const me = actorId(req);

await assertVPScheduleReferences(readClient, data);
await assertVPScheduleBranchAreaAlignment(readClient, data);

const { start, end } = getDateRange(data.scheduleDate);

const duplicate = await db.vPSchedule.findFirst({
  where: {
    deletedAt: null,

    scheduleDate: {
      gte: start,
      lt: end,
    },

    fromBranchId: data.fromBranchId,
    toBranchId: data.toBranchId,

    sourceAreaId: data.sourceAreaId,
    destinationAreaId: data.destinationAreaId,
  },
  select: {
    id: true,
    scheduleNumber: true,
  },
});

if (duplicate) {
  throw new ConflictError(
    `VP Schedule already exists for this date, branch route and area route: ${duplicate.scheduleNumber}`,
  );
}

await assertVPScheduleFreightMatrices(readClient, data);

const totals = await calculateVPScheduleTotals(readClient, data.wagonCounts);

const wagonRows = await buildWagonCountRows(readClient, {
  sourceAreaId: data.sourceAreaId,
  destinationAreaId: data.destinationAreaId,
  wagonCounts: data.wagonCounts,
});
  const schedule = await db.$transaction(async (tx) => {
    const { scheduleNumber } = await generateVPScheduleNumber(
      tx,
      data.fromBranchId,
    );

    const createdBase = await tx.vPSchedule.create({
      data: {
        scheduleNumber,
        scheduleDate: data.scheduleDate,
        scheduleName: data.scheduleName,

        fromBranchId: data.fromBranchId,
        toBranchId: data.toBranchId,

        sourceAreaId: data.sourceAreaId,
        destinationAreaId: data.destinationAreaId,

        status: "DRAFT",

        totalWagonCount: totals.totalWagonCount,
        totalCapacityCft: totals.totalCapacityCft,
        totalCapacityMt: totals.totalCapacityMt,

        remarks: data.remarks ?? null,

        createdById: me,
      },
      select: { id: true },
    });

    await tx.vPScheduleWagonCount.createMany({
      data: wagonRows.map((row) => ({
        ...row,
        vpScheduleId: createdBase.id,
      })),
    });

    const created = await tx.vPSchedule.findUnique({
      where: { id: createdBase.id },
      include: vpScheduleInclude,
    });

    if (!created) {
      throw new BadRequestError("VP Schedule could not be created");
    }

    return created;
  });

  return sendOk(res, schedule, undefined, 201);
});

/* ------------------------------------------------------------------ */
/* Update -> only DRAFT                                               */
/* ------------------------------------------------------------------ */

router.patch("/:id", can(PERMS.VP_SCHEDULE.UPDATE), async (req, res) => {
  const identifier = getVPScheduleIdentifier(req);

  const existing = await db.vPSchedule.findFirst({
    where: vpScheduleWhereByIdentifier(identifier),
    include: {
      wagonCounts: {
        select: {
          wagonId: true,
          count: true,
        },
      },
    },
  });

  if (!existing) {
    throw new NotFoundError("VP Schedule not found");
  }

  assertBranchAccess(req, existing.fromBranchId);

  if (existing.status !== "DRAFT") {
    throw new BadRequestError("Only a DRAFT VP Schedule can be edited");
  }

  const clientVersion =
    typeof req.body?.version === "number" ? req.body.version : undefined;

  if (clientVersion !== undefined && clientVersion !== existing.version) {
    throw new ConflictError(
      "This VP Schedule changed in another tab — reload and retry",
    );
  }

  const parsed = updateVPScheduleSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;
  const me = actorId(req);

  if (data.fromBranchId) {
    assertBranchAccess(req, data.fromBranchId);
  }

  const effectiveRoute = {
    fromBranchId: data.fromBranchId ?? existing.fromBranchId,
    toBranchId: data.toBranchId ?? existing.toBranchId,
    sourceAreaId: data.sourceAreaId ?? existing.sourceAreaId,
    destinationAreaId: data.destinationAreaId ?? existing.destinationAreaId,
  };

  await assertVPScheduleReferences(readClient, data);
  await assertVPScheduleBranchAreaAlignment(readClient, effectiveRoute);
  await assertVPScheduleFreightMatrices(readClient, {
    sourceAreaId: effectiveRoute.sourceAreaId,
    destinationAreaId: effectiveRoute.destinationAreaId,
    wagonCounts: data.wagonCounts ?? existing.wagonCounts,
  });

  const wagonUpdate =
    data.wagonCounts
      ? {
          totals: await calculateVPScheduleTotals(readClient, data.wagonCounts),
          rows: await buildWagonCountRows(readClient, {
  sourceAreaId: effectiveRoute.sourceAreaId,
  destinationAreaId: effectiveRoute.destinationAreaId,
  wagonCounts: data.wagonCounts,
}),
        }
      : null;

  const updated = await db.$transaction(async (tx) => {
    let wagonUpdateData = {};

    if (wagonUpdate) {
      await tx.vPScheduleWagonCount.deleteMany({
        where: {
          vpScheduleId: existing.id,
        },
      });

      wagonUpdateData = {
        totalWagonCount: wagonUpdate.totals.totalWagonCount,
        totalCapacityCft: wagonUpdate.totals.totalCapacityCft,
        totalCapacityMt: wagonUpdate.totals.totalCapacityMt,
      };
    }

    await tx.vPSchedule.update({
      where: {
        id: existing.id,
      },
      data: {
        ...(data.scheduleDate ? { scheduleDate: data.scheduleDate } : {}),
        ...(data.scheduleName ? { scheduleName: data.scheduleName } : {}),

        ...(data.fromBranchId ? { fromBranchId: data.fromBranchId } : {}),
        ...(data.toBranchId ? { toBranchId: data.toBranchId } : {}),

        ...(data.sourceAreaId ? { sourceAreaId: data.sourceAreaId } : {}),
        ...(data.destinationAreaId
          ? { destinationAreaId: data.destinationAreaId }
          : {}),

        ...(data.remarks !== undefined ? { remarks: data.remarks } : {}),

        ...wagonUpdateData,

        updatedById: me,
        version: {
          increment: 1,
        },
      },
    });

    if (wagonUpdate) {
      await tx.vPScheduleWagonCount.createMany({
        data: wagonUpdate.rows.map((row) => ({
          ...row,
          vpScheduleId: existing.id,
        })),
      });
    }

    const row = await tx.vPSchedule.findUnique({
      where: { id: existing.id },
      include: vpScheduleInclude,
    });

    if (!row) {
      throw new BadRequestError("VP Schedule could not be updated");
    }

    return row;
  });

  return sendOk(res, updated);
});

/* ------------------------------------------------------------------ */
/* Confirm -> DRAFT to PLANNED                                        */
/* ------------------------------------------------------------------ */

router.post(
  "/:id/confirm",
  can(PERMS.VP_SCHEDULE.CONFIRM),
  async (req, res) => {
    const identifier = getVPScheduleIdentifier(req);

    const existing = await db.vPSchedule.findFirst({
      where: vpScheduleWhereByIdentifier(identifier),
      include: {
        wagonCounts: true,
      },
    });

    if (!existing) {
      throw new NotFoundError("VP Schedule not found");
    }

    assertBranchAccess(req, existing.fromBranchId);

    if (existing.status !== "DRAFT") {
      throw new BadRequestError("Only a DRAFT VP Schedule can be confirmed");
    }

    if (!existing.wagonCounts.length) {
      throw new BadRequestError(
        "At least one wagon is required before confirming VP Schedule",
      );
    }

    await assertVPScheduleBranchAreaAlignment(readClient, {
      fromBranchId: existing.fromBranchId,
      toBranchId: existing.toBranchId,
      sourceAreaId: existing.sourceAreaId,
      destinationAreaId: existing.destinationAreaId,
    });

    await assertVPScheduleFreightMatrices(readClient, {
      sourceAreaId: existing.sourceAreaId,
      destinationAreaId: existing.destinationAreaId,
      wagonCounts: existing.wagonCounts,
    });

    const parsed = confirmVPScheduleSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const me = actorId(req);

    const updated = await db.vPSchedule.update({
      where: {
        id: existing.id,
      },
      data: {
        status: "PLANNED",
        remarks: parsed.data.remarks ?? existing.remarks,
        updatedById: me,
        version: {
          increment: 1,
        },
      },
      include: vpScheduleInclude,
    });

    return sendOk(res, updated);
  },
);

/* ------------------------------------------------------------------ */
/* Cancel -> DRAFT / PLANNED to CANCELLED                             */
/* ------------------------------------------------------------------ */

router.post(
  "/:id/cancel",
  can(PERMS.VP_SCHEDULE.CANCEL),
  async (req, res) => {
    const identifier = getVPScheduleIdentifier(req);

    const existing = await db.vPSchedule.findFirst({
      where: vpScheduleWhereByIdentifier(identifier),
    });

    if (!existing) {
      throw new NotFoundError("VP Schedule not found");
    }

    assertBranchAccess(req, existing.fromBranchId);

    if (!["DRAFT", "PLANNED"].includes(existing.status)) {
      throw new BadRequestError(
        "Only a DRAFT or PLANNED VP Schedule can be cancelled",
      );
    }

    const parsed = cancelVPScheduleSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const me = actorId(req);

    const updated = await db.vPSchedule.update({
      where: {
        id: existing.id,
      },
      data: {
        status: "CANCELLED",
        remarks: parsed.data.reason,
        updatedById: me,
        version: {
          increment: 1,
        },
      },
      include: vpScheduleInclude,
    });

    return sendOk(res, updated);
  },
);

/* ------------------------------------------------------------------ */
/* Delete -> only DRAFT soft delete                                   */
/* ------------------------------------------------------------------ */

router.delete("/:id", can(PERMS.VP_SCHEDULE.DELETE), async (req, res) => {
  const identifier = getVPScheduleIdentifier(req);

  const existing = await db.vPSchedule.findFirst({
    where: vpScheduleWhereByIdentifier(identifier),
  });

  if (!existing) {
    throw new NotFoundError("VP Schedule not found");
  }

  assertBranchAccess(req, existing.fromBranchId);


  const me = actorId(req);

  const deleted = await db.vPSchedule.update({
    where: {
      id: existing.id,
    },
    data: {
      deletedAt: new Date(),
      updatedById: me,
      version: {
        increment: 1,
      },
    },
    include: vpScheduleInclude,
  });

  return sendOk(res, deleted);
});

export default router;
