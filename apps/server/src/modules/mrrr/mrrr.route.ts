import { Router } from "express";
import { Prisma } from "../../../generated/prisma/index.js";
import {
  createMRRRSchema,
  updateMRRRSchema,
  updateMRRRRowsSchema,
  submitMRRRSchema,
  cancelMRRRSchema,
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
  buildMRRRPreviewRows,
  getMRRRRequiredRowsMissingFields,
  getMRRRSearchWhere,
  mrrrInclude,
  mrrrListSelect,
} from "./mrrr.service.js";
import { getDateRange } from "../vp-schedule/vp-schedule.route.js";

const router: Router = Router();

router.use(authMiddleware);

const getActorId = (req: { user?: { userId: string } }) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw new BadRequestError("User is required");
  }

  return userId;
};

const getIdParam = (
  value: string | string[] | undefined,
  label: string,
) => {
  const rawValue = Array.isArray(value) ? value[0] : value;

  const id = decodeURIComponent(rawValue ?? "").trim();

  if (!id) {
    throw new BadRequestError(`${label} is required`);
  }

  return id;
};
const mrrrIdentifierWhere = (identifier: string): Prisma.MRRRWhereInput => ({
  deletedAt: null,
  OR: [
    { id: identifier },
    { mrRrNumber: identifier },
    {
      vpSchedule: {
        scheduleNumber: identifier,
      },
    },
  ],
});

/**
 * GET /mrrr/vp-schedules
 * Dropdown list for MR/RR Generate.
 * Shows only PLANNED VP schedules where MR/RR is not already created.
 */
router.get(
  "/vp-schedules",
  can(PERMS.MRRR.CREATE),
  async (req, res) => {
    const query = parseListQuery(req);
    const scheduleDate =
  typeof req.query.scheduleDate === "string"
    ? req.query.scheduleDate
    : undefined;

const dateRange = scheduleDate ? getDateRange(scheduleDate) : null;
    const where: Prisma.VPScheduleWhereInput = {
      deletedAt: null,
      status: "PLANNED",
      mrRr: null,
      ...branchFilter(req, "fromBranchId"),
      ...(dateRange
    ? {
        scheduleDate: {
          gte: dateRange.start,
          lt: dateRange.end,
        },
      }
    : {}),
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
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      db.vPSchedule.findMany({
        where,
        skip: query.page * query.size,
        take: query.size,
        select: {
          id: true,
          scheduleNumber: true,
          scheduleDate: true,
          scheduleName: true,
          totalWagonCount: true,
          fromBranch: {
            select: {
              id: true,
              name: true,
              branchCode: true,
            },
          },
          toBranch: {
            select: {
              id: true,
              name: true,
              branchCode: true,
            },
          },
        },
        orderBy: {
          scheduleDate: "desc",
        },
      }),
      db.vPSchedule.count({ where }),
    ]);

    return sendOk(
      res,
      data.map((item) => ({
        ...item,
        label: item.scheduleNumber,
        value: item.id,
      })),
      {
        page: query.page,
        size: query.size,
        total,
      },
    );
  },
);

/**
 * GET /mrrr/vp-schedules/:vpScheduleId/preview
 * Preview MR/RR rows before creating MR/RR.
 */

router.get(
  "/vp-schedules/:vpScheduleId/preview",
  can(PERMS.MRRR.VIEW),
  async (req, res) => {
    const vpScheduleId = getIdParam(req.params.vpScheduleId, "VP Schedule");

    const schedule = await db.vPSchedule.findFirst({
      where: {
        id: vpScheduleId,
        deletedAt: null,
      },
      include: {
        fromBranch: {
          select: {
            id: true,
            name: true,
            branchCode: true,
          },
        },
        toBranch: {
          select: {
            id: true,
            name: true,
            branchCode: true,
          },
        },
        sourceArea: {
          select: {
            id: true,
            name: true,
          },
        },
        destinationArea: {
          select: {
            id: true,
            name: true,
          },
        },
        wagonCounts: {
          include: {
            wagon: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        mrRr: {
          select: {
            id: true,
            mrRrNumber: true,
            status: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundError("VP Schedule not found");
    }

    assertBranchAccess(req, schedule.fromBranchId);

    if (schedule.status !== "PLANNED") {
      throw new BadRequestError("Only PLANNED VP Schedule can be used for MR/RR");
    }

    if (schedule.mrRr) {
      throw new ConflictError(
        "MR/RR already exists for this VP Schedule",
        "CONFLICT",
        {
          vpScheduleId: schedule.id,
          existingMRRR: schedule.mrRr,
        },
      );
    }

    if (!schedule.wagonCounts.length) {
      throw new BadRequestError("VP Schedule has no wagon counts");
    }

    const rows = buildMRRRPreviewRows(schedule.wagonCounts);

    return sendOk(res, {
      vpSchedule: schedule,
      rows,
    });
  },
);

/**
 * POST /mrrr
 * Create MR/RR and auto-generate rows from VP Schedule wagonCounts.
 */

router.post(
  "/",
  can(PERMS.MRRR.CREATE),
  async (req, res) => {
    const parsed = createMRRRSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const data = parsed.data;
    const actorId = getActorId(req);

    const created = await db.$transaction(async (tx) => {
      const schedule = await tx.vPSchedule.findFirst({
        where: {
          id: data.vpScheduleId,
          deletedAt: null,
        },
        include: {
          wagonCounts: {
            include: {
              wagon: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: {
              createdAt: "asc",
            },
          },
          mrRr: {
            select: {
              id: true,
              mrRrNumber: true,
              status: true,
              deletedAt: true,
            },
          },
        },
      });

      if (!schedule) {
        throw new NotFoundError("VP Schedule not found");
      }

      assertBranchAccess(req, schedule.fromBranchId);

      if (schedule.status !== "PLANNED") {
        throw new BadRequestError("Only PLANNED VP Schedule can be used for MR/RR");
      }

      if (schedule.mrRr) {
        throw new ConflictError(
          "MR/RR already exists for this VP Schedule",
          "CONFLICT",
          {
            vpScheduleId: schedule.id,
            existingMRRR: schedule.mrRr,
          },
        );
      }

      if (!schedule.wagonCounts.length) {
        throw new BadRequestError("VP Schedule has no wagon counts");
      }

      const generatedRows = buildMRRRPreviewRows(schedule.wagonCounts);
      const inputRowsByNumber = new Map(
        (data.rows ?? []).map((row) => [row.rowNumber, row]),
      );

      const mrrr = await tx.mRRR.create({
        data: {
          vpScheduleId: schedule.id,
          rakeType: data.rakeType ?? null,
          remarks: data.remarks ?? null,
          status: "DRAFT",
          createdById: actorId,
        },
        select: {
          id: true,
        },
      });

      await tx.mRRRRow.createMany({
        data: generatedRows.map((row) => {
          const inputRow = inputRowsByNumber.get(row.rowNumber);

          return {
            mrRrId: mrrr.id,
            vpScheduleWagonCountId: row.vpScheduleWagonCountId,
            wagonId: row.wagonId,
            wagonTypeLabel: row.wagonTypeLabel,
            rowNumber: row.rowNumber,
            rowLabel: row.rowLabel,
            sequenceNo: inputRow?.sequenceNo ?? null,
            vpNo: inputRow?.vpNo ?? null,
            mrRrNo: inputRow?.mrRrNo ?? null,
            sealNo: inputRow?.sealNo ?? null,
          };
        }),
      });

      const result = await tx.mRRR.findUnique({
        where: {
          id: mrrr.id,
        },
        include: mrrrInclude,
      });

      if (!result) {
        throw new BadRequestError("MR/RR could not be created");
      }

      return result;
    });

    return sendOk(res, created, undefined, 201);
  },
);

/**
 * GET /mrrr
 * List MR/RR documents.
 */
router.get(
  "/",
  can(PERMS.MRRR.VIEW),
  async (req, res) => {
    const query = parseListQuery(req);

  const status =
  typeof req.query.status === "string" &&
  ["DRAFT", "SUBMITTED", "CANCELLED"].includes(req.query.status)
    ? req.query.status
    : undefined;

    const where: Prisma.MRRRWhereInput = {
      deletedAt: null,
      ...(status ? { status: status as Prisma.EnumMRRRStatusFilter } : {}),
      ...getMRRRSearchWhere(query.search),
      vpSchedule: {
        ...branchFilter(req, "fromBranchId"),
      },
    };

    const [data, total] = await Promise.all([
      db.mRRR.findMany({
        where,
        skip: query.page * query.size,
        take: query.size,
        select: mrrrListSelect,
        orderBy: {
          createdAt: "desc",
        },
      }),
      db.mRRR.count({ where }),
    ]);

    return sendOk(res, data, {
      page: query.page,
      size: query.size,
      total,
    });
  },
);

/**
 * GET /mrrr/:id
 * Get MR/RR detail.
 */
router.get(
  "/:id",
  can(PERMS.MRRR.VIEW),
  async (req, res) => {
    const identifier = getIdParam(req.params.id, "MR/RR");

    const data = await db.mRRR.findFirst({
      where: mrrrIdentifierWhere(identifier),
      include: mrrrInclude,
    });

    if (!data) {
      throw new NotFoundError("MR/RR not found");
    }

    assertBranchAccess(req, data.vpSchedule.fromBranchId);

    return sendOk(res, data);
  },
);

/**
 * PATCH /mrrr/:id
 * Update MR/RR header.
 */
router.patch(
  "/:id",
  can(PERMS.MRRR.UPDATE),
  async (req, res) => {
    const identifier = getIdParam(req.params.id, "MR/RR");

    const parsed = updateMRRRSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const body = parsed.data;
    const actorId = getActorId(req);

    const existing = await db.mRRR.findFirst({
      where: mrrrIdentifierWhere(identifier),
      include: {
        vpSchedule: {
          select: {
            fromBranchId: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundError("MR/RR not found");
    }

    assertBranchAccess(req, existing.vpSchedule.fromBranchId);

    if (existing.status !== "DRAFT") {
      throw new BadRequestError("Only DRAFT MR/RR can be updated");
    }

    const updated = await db.mRRR.update({
      where: {
        id: existing.id,
      },
      data: {
        rakeType: body.rakeType ?? existing.rakeType,
        remarks: body.remarks ?? existing.remarks,
        updatedById: actorId,
        version: {
          increment: 1,
        },
      },
      include: mrrrInclude,
    });

    return sendOk(res, updated);
  },
);

/**
 * PATCH /mrrr/:id/rows
 * Bulk update MR/RR row railway details.
 */
router.patch(
  "/:id/rows",
  can(PERMS.MRRR.UPDATE),
  async (req, res) => {
    const identifier = getIdParam(req.params.id, "MR/RR");

    const parsed = updateMRRRRowsSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const body = parsed.data;
    const actorId = getActorId(req);

    const updated = await db.$transaction(async (tx) => {
      const existing = await tx.mRRR.findFirst({
        where: mrrrIdentifierWhere(identifier),
        include: {
          vpSchedule: {
            select: {
              fromBranchId: true,
            },
          },
          rows: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!existing) {
        throw new NotFoundError("MR/RR not found");
      }

      assertBranchAccess(req, existing.vpSchedule.fromBranchId);

      if (existing.status !== "DRAFT") {
        throw new BadRequestError("Only DRAFT MR/RR rows can be updated");
      }

      const validRowIds = new Set(existing.rows.map((row) => row.id));

      for (const row of body.rows) {
        if (!validRowIds.has(row.id)) {
          throw new BadRequestError("Invalid MR/RR row selected");
        }
      }

      await Promise.all(
        body.rows.map((row) =>
          tx.mRRRRow.update({
            where: {
              id: row.id,
            },
            data: {
              sequenceNo: row.sequenceNo ?? null,
              vpNo: row.vpNo ?? null,
              mrRrNo: row.mrRrNo ?? null,
              sealNo: row.sealNo ?? null,
            },
          }),
        ),
      );

      await tx.mRRR.update({
        where: {
          id: existing.id,
        },
        data: {
          updatedById: actorId,
          version: {
            increment: 1,
          },
        },
      });

      const result = await tx.mRRR.findUnique({
        where: {
          id: existing.id,
        },
        include: mrrrInclude,
      });

      if (!result) {
        throw new BadRequestError("MR/RR could not be updated");
      }

      return result;
    });

    return sendOk(res, updated);
  },
);

/**
 * POST /mrrr/:id/submit
 * Submit MR/RR after validating row details.
 */
router.post(
  "/:id/submit",
  can(PERMS.MRRR.SUBMIT),
  async (req, res) => {
    const identifier = getIdParam(req.params.id, "MR/RR");

    const parsed = submitMRRRSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const body = parsed.data;
    const actorId = getActorId(req);

    const existing = await db.mRRR.findFirst({
      where: mrrrIdentifierWhere(identifier),
      include: {
        vpSchedule: {
          select: {
            id: true,
            fromBranchId: true,
            status: true,
          },
        },
        rows: {
          select: {
            id: true,
            rowLabel: true,
            sequenceNo: true,
            vpNo: true,
            mrRrNo: true,
            sealNo: true,
            vpWagonLoading: {
              select: {
                id: true,
              },
            },
          },
          orderBy: {
            rowNumber: "asc",
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundError("MR/RR not found");
    }

    assertBranchAccess(req, existing.vpSchedule.fromBranchId);

    if (existing.status !== "DRAFT") {
      throw new BadRequestError("Only DRAFT MR/RR can be submitted");
    }

    if (existing.vpSchedule.status !== "PLANNED") {
      throw new BadRequestError("Only PLANNED VP Schedule MR/RR can be submitted");
    }

    if (existing.rows.some((row) => row.vpWagonLoading)) {
      throw new BadRequestError("MR/RR already has VP Loading rows");
    }

    if (!existing.rows.length) {
      throw new BadRequestError("MR/RR has no rows");
    }

    const missingRows = getMRRRRequiredRowsMissingFields(existing.rows);

    if (missingRows.length) {
      throw new ValidationError({
        rows: missingRows.map(
          (row) => `${row.rowLabel}: ${row.missing.join(", ")} required`,
        ),
      });
    }

    const updated = await db.$transaction(async (tx) => {
      await tx.vPSchedule.update({
        where: {
          id: existing.vpSchedule.id,
        },
        data: {
          status: "MRRR_CREATED",
          updatedById: actorId,
          version: {
            increment: 1,
          },
        },
      });

      return tx.mRRR.update({
        where: {
          id: existing.id,
        },
        data: {
          status: "SUBMITTED",
          remarks: body.remarks ?? existing.remarks,
          updatedById: actorId,
          version: {
            increment: 1,
          },
        },
        include: mrrrInclude,
      });
    });

    return sendOk(res, updated);
  },
);

/**
 * POST /mrrr/:id/cancel
 * Cancel MR/RR.
 */
router.post(
  "/:id/cancel",
  can(PERMS.MRRR.CANCEL),
  async (req, res) => {
    const identifier = getIdParam(req.params.id, "MR/RR");

    const parsed = cancelMRRRSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const body = parsed.data;
    const actorId = getActorId(req);

    const existing = await db.mRRR.findFirst({
      where: mrrrIdentifierWhere(identifier),
      include: {
        vpSchedule: {
          select: {
            id: true,
            fromBranchId: true,
            status: true,
          },
        },
        rows: {
          select: {
            vpWagonLoading: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundError("MR/RR not found");
    }

    assertBranchAccess(req, existing.vpSchedule.fromBranchId);

    if (existing.status === "CANCELLED") {
      throw new BadRequestError("MR/RR is already cancelled");
    }

    if (existing.rows.some((row) => row.vpWagonLoading)) {
      throw new BadRequestError("MR/RR cannot be cancelled after VP Loading is created");
    }

    const updated = await db.$transaction(async (tx) => {
      if (existing.status === "SUBMITTED" && existing.vpSchedule.status === "MRRR_CREATED") {
        await tx.vPSchedule.update({
          where: {
            id: existing.vpSchedule.id,
          },
          data: {
            status: "PLANNED",
            updatedById: actorId,
            version: {
              increment: 1,
            },
          },
        });
      }

      return tx.mRRR.update({
        where: {
          id: existing.id,
        },
        data: {
          status: "CANCELLED",
          remarks: body.reason,
          updatedById: actorId,
          version: {
            increment: 1,
          },
        },
        include: mrrrInclude,
      });
    });

    return sendOk(res, updated);
  },
);

/**
 * DELETE /mrrr/:id
 * Soft delete MR/RR.
 */
router.delete(
  "/:id",
  can(PERMS.MRRR.DELETE),
  async (req, res) => {
    const identifier = getIdParam(req.params.id, "MR/RR");
    const actorId = getActorId(req);

    const existing = await db.mRRR.findFirst({
      where: mrrrIdentifierWhere(identifier),
      include: {
        vpSchedule: {
          select: {
            fromBranchId: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundError("MR/RR not found");
    }

    assertBranchAccess(req, existing.vpSchedule.fromBranchId);

    if (existing.status === "SUBMITTED") {
      throw new BadRequestError("Submitted MR/RR cannot be deleted");
    }

    const deleted = await db.mRRR.update({
      where: {
        id: existing.id,
      },
      data: {
        deletedAt: new Date(),
        updatedById: actorId,
        version: {
          increment: 1,
        },
      },
      select: {
        id: true,
      },
    });

    return sendOk(res, deleted);
  },
);

export default router;
