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



const actorId = (req: { user?: { userId: string } }) => req.user!.userId;

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
  wagonCounts: {
    wagonId: string;
    count: number;
  }[],
) => {
  const wagonIds = wagonCounts.map((item) => item.wagonId);

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

  const wagonMap = new Map(wagons.map((wagon) => [wagon.id, wagon]));

  return wagonCounts.map((item) => {
    const wagon = wagonMap.get(item.wagonId);

    if (!wagon) {
      throw new BadRequestError("Selected wagon not found");
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

  const schedule = await db.$transaction(async (tx) => {
    await assertVPScheduleReferences(tx, data);
    await assertVPScheduleBranchAreaAlignment(tx, data);

    const { scheduleNumber } = await generateVPScheduleNumber(
      tx,
      data.fromBranchId,
    );

    const totals = await calculateVPScheduleTotals(tx, data.wagonCounts);

    const wagonRows = await buildWagonCountRows(tx, data.wagonCounts);

    const created = await tx.vPSchedule.create({
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

        wagonCounts: {
          create: wagonRows,
        },
      },
      include: vpScheduleInclude,
    });

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

  const updated = await db.$transaction(async (tx) => {
    await assertVPScheduleReferences(tx, data);
    await assertVPScheduleBranchAreaAlignment(tx, {
      fromBranchId: data.fromBranchId ?? existing.fromBranchId,
      toBranchId: data.toBranchId ?? existing.toBranchId,
      sourceAreaId: data.sourceAreaId ?? existing.sourceAreaId,
      destinationAreaId: data.destinationAreaId ?? existing.destinationAreaId,
    });

    let wagonUpdateData = {};

    if (data.wagonCounts) {
      const totals = await calculateVPScheduleTotals(tx, data.wagonCounts);
      const wagonRows = await buildWagonCountRows(tx, data.wagonCounts);

      await tx.vPScheduleWagonCount.deleteMany({
        where: {
          vpScheduleId: existing.id,
        },
      });

      wagonUpdateData = {
        totalWagonCount: totals.totalWagonCount,
        totalCapacityCft: totals.totalCapacityCft,
        totalCapacityMt: totals.totalCapacityMt,
        wagonCounts: {
          create: wagonRows,
        },
      };
    }

    const row = await tx.vPSchedule.update({
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
      include: vpScheduleInclude,
    });

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

    await db.$transaction(async (tx) => {
      await assertVPScheduleBranchAreaAlignment(tx, {
        fromBranchId: existing.fromBranchId,
        toBranchId: existing.toBranchId,
        sourceAreaId: existing.sourceAreaId,
        destinationAreaId: existing.destinationAreaId,
      });

      await assertVPScheduleFreightMatrices(tx, {
        sourceAreaId: existing.sourceAreaId,
        destinationAreaId: existing.destinationAreaId,
        wagonCounts: existing.wagonCounts,
      });
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

  if (existing.status !== "DRAFT") {
    throw new BadRequestError(
      "Only a DRAFT VP Schedule can be deleted. Please cancel it instead.",
    );
  }

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
