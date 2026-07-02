import { Router } from "express";
import { VPLoadingStatus } from "../../../generated/prisma/index.js";

import {
  createVPLoadingSchema,
  updateVPLoadingSchema,
  markVPLoadedSchema,
  cancelVPLoadingSchema,
} from "@skerp/validators";
import { PERMS } from "@skerp/types";

import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { assertBranchAccess } from "../../auth/branch-scope.js";
import { parseListQuery } from "../_shared/list.query.js";
import { sendOk } from "../_shared/response.js";

import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../lib/error.js";

import {
  vpLoadingListSelect,
  vpLoadingDetailInclude,
  fyCodeFor,
  nextSequence,
  formatDocNumber,
  buildVPLoadingMoneyData,
  toDecimalOrNull,
} from "./vploading.service.js";

const router: Router = Router();

router.use(authMiddleware);

const actorId = (req: { user?: { userId: string } }) => req.user!.userId;

const getVPLoadingIdentifier = (req: {
  params: { id?: string | string[] };
}) => {
  const rawId = req.params.id;

  const identifier = decodeURIComponent(
    Array.isArray(rawId) ? rawId[0] ?? "" : rawId ?? "",
  ).trim();

  if (!identifier) {
    throw new BadRequestError("VP Loading identifier is required");
  }

  return identifier;
};

const vpLoadingWhereByIdentifier = (identifier: string) => ({
  deletedAt: null,
  OR: [{ id: identifier }, { loadingNumber: identifier }],
});

/* ------------------------------------------------------------------ */
/* List                                                               */
/* ------------------------------------------------------------------ */
router.get("/", can(PERMS.VP_LOADING.VIEW), async (req, res) => {
  const query = parseListQuery(req);

  const status =
    typeof query.filter.status === "string" &&
    Object.values(VPLoadingStatus).includes(
      query.filter.status as VPLoadingStatus,
    )
      ? (query.filter.status as VPLoadingStatus)
      : undefined;

  const vpScheduleId =
    typeof query.filter.vpScheduleId === "string"
      ? query.filter.vpScheduleId
      : undefined;

  const where = {
    deletedAt: null,

    ...(status ? { status } : {}),

    ...(vpScheduleId ? { vpScheduleId } : {}),

    ...(query.search
      ? {
          OR: [
            {
              loadingNumber: {
                contains: query.search,
                mode: "insensitive" as const,
              },
            },
            {
              gateNo: {
                contains: query.search,
                mode: "insensitive" as const,
              },
            },
            {
              lorryReceipt: {
                lrNumber: {
                  contains: query.search,
                  mode: "insensitive" as const,
                },
              },
            },
            {
              grn: {
                grnNumber: {
                  contains: query.search,
                  mode: "insensitive" as const,
                },
              },
            },
            {
              vpSchedule: {
                scheduleName: {
                  contains: query.search,
                  mode: "insensitive" as const,
                },
              },
            },
            {
              mrRrRow: {
                vpNo: {
                  contains: query.search,
                  mode: "insensitive" as const,
                },
              },
            },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    db.vPLoading.findMany({
      where,
      skip: query.page * query.size,
      take: query.size,
      select: vpLoadingListSelect,
      orderBy: query.sort
        ? { [query.sort.field]: query.sort.direction }
        : { createdAt: "desc" },
    }),

    db.vPLoading.count({ where }),
  ]);

  return sendOk(res, data, {
    page: query.page,
    size: query.size,
    total,
  });
});

/* ------------------------------------------------------------------ */
/* Status counts                                                      */
/* ------------------------------------------------------------------ */
router.get("/status-counts", can(PERMS.VP_LOADING.VIEW), async (_req, res) => {
  const grouped = await db.vPLoading.groupBy({
    by: ["status"],
    where: {
      deletedAt: null,
    },
    _count: {
      _all: true,
    },
  });

  const counts: Record<string, number> = {};
  let all = 0;

  for (const group of grouped) {
    counts[group.status] = group._count._all;
    all += group._count._all;
  }

  counts.ALL = all;

  return sendOk(res, counts);
});

/* ------------------------------------------------------------------ */
/* Preview by VP Schedule                                             */
/* ------------------------------------------------------------------ */
router.get(
  "/preview/:vpScheduleId",
  can(PERMS.VP_LOADING.CREATE),
  async (req, res) => {
    const rawVpScheduleId = req.params.vpScheduleId;

    const vpScheduleId = decodeURIComponent(
      Array.isArray(rawVpScheduleId)
        ? rawVpScheduleId[0] ?? ""
        : rawVpScheduleId ?? "",
    ).trim();

    if (!vpScheduleId) {
      throw new BadRequestError("VP Schedule is required");
    }

    const vpSchedule = await db.vPSchedule.findFirst({
      where: {
        id: vpScheduleId,
        deletedAt: null,
      },
      select: {
        id: true,
        scheduleNumber: true,
        scheduleName: true,
        scheduleDate: true,
        status: true,
        fromBranchId: true,

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

        mrRr: {
          select: {
            id: true,
            mrRrNumber: true,
            status: true,
            rakeType: true,

            rows: {
              orderBy: {
                rowNumber: "asc",
              },
              select: {
                id: true,
                rowNumber: true,
                rowLabel: true,
                wagonTypeLabel: true,
                vpNo: true,
                mrRrNo: true,
                sealNo: true,

                vpLoadings: {
                  where: {
                    deletedAt: null,
                    status: "LOADED",
                  },
                  select: {
                    loadedQty: true,
                  },
                },
              },
            },
          },
        },

        grns: {
          where: {
            deletedAt: null,
            status: "SUBMITTED",
          },
          select: {
            id: true,
            grnNumber: true,
            lorryReceiptId: true,
            receivedQty: true,
            status: true,

            lorryReceipt: {
              select: {
                id: true,
                lrNumber: true,
              },
            },

            vpLoadings: {
              where: {
                deletedAt: null,
                status: "LOADED",
              },
              select: {
                loadedQty: true,
              },
            },
          },
        },
      },
    });

    if (!vpSchedule) {
      throw new NotFoundError("VP Schedule not found");
    }

    assertBranchAccess(req, vpSchedule.fromBranchId);

    if (vpSchedule.status === "CANCELLED") {
      throw new BadRequestError(
        "Cancelled VP Schedule cannot be used for VP Loading",
      );
    }

    if (!vpSchedule.mrRr) {
      throw new BadRequestError("Create MR/RR before VP Loading");
    }

    if (vpSchedule.mrRr.status === "CANCELLED") {
      throw new BadRequestError("Cancelled MR/RR cannot be used for VP Loading");
    }

    return sendOk(res, {
      vpSchedule: {
        id: vpSchedule.id,
        scheduleNumber: vpSchedule.scheduleNumber,
        scheduleName: vpSchedule.scheduleName,
        scheduleDate: vpSchedule.scheduleDate,
        status: vpSchedule.status,
        fromBranch: vpSchedule.fromBranch,
        toBranch: vpSchedule.toBranch,
        sourceArea: vpSchedule.sourceArea,
        destinationArea: vpSchedule.destinationArea,
      },

      mrRr: {
        id: vpSchedule.mrRr.id,
        mrRrNumber: vpSchedule.mrRr.mrRrNumber,
        status: vpSchedule.mrRr.status,
        rakeType: vpSchedule.mrRr.rakeType,
      },

      rows: vpSchedule.mrRr.rows.map((row) => ({
        mrRrRowId: row.id,
        rowNumber: row.rowNumber,
        rowLabel: row.rowLabel,
        wagonTypeLabel: row.wagonTypeLabel,
        vpNo: row.vpNo,
        mrRrNo: row.mrRrNo,
        sealNo: row.sealNo,
        loadedQty: row.vpLoadings.reduce(
          (sum, loading) => sum + loading.loadedQty,
          0,
        ),
      })),

    
    });
  },
);

/* ------------------------------------------------------------------ */
/* Detail                                                             */
/* ------------------------------------------------------------------ */
router.get("/:id", can(PERMS.VP_LOADING.VIEW), async (req, res) => {
  const identifier = getVPLoadingIdentifier(req);

  const loading = await db.vPLoading.findFirst({
    where: vpLoadingWhereByIdentifier(identifier),
    include: vpLoadingDetailInclude,
  });

  if (!loading) {
    throw new NotFoundError("VP Loading not found");
  }

  assertBranchAccess(req, loading.vpSchedule.fromBranchId);

  return sendOk(res, loading);
});

/* ------------------------------------------------------------------ */
/* Create                                                             */
/* ------------------------------------------------------------------ */
router.post("/", can(PERMS.VP_LOADING.CREATE), async (req, res) => {
  const parsed = createVPLoadingSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;
  const me = actorId(req);

  const created = await db.$transaction(async (tx) => {
    const [vpSchedule, mrRr, mrRrRow, grn] = await Promise.all([
      tx.vPSchedule.findFirst({
        where: {
          id: data.vpScheduleId,
          deletedAt: null,
        },
        include: {
          fromBranch: {
            select: {
              branchCode: true,
            },
          },
        },
      }),

      tx.mRRR.findFirst({
        where: {
          id: data.mrRrId,
          deletedAt: null,
        },
      }),

      tx.mRRRRow.findFirst({
        where: {
          id: data.mrRrRowId,
        },
      }),

      tx.gRN.findFirst({
        where: {
          id: data.grnId,
          deletedAt: null,
        },
        include: {
          lorryReceipt: {
            select: {
              id: true,
              lrNumber: true,
            },
          },
          vpLoadings: {
            where: {
              deletedAt: null,
              status: "LOADED",
            },
            select: {
              loadedQty: true,
            },
          },
        },
      }),
    ]);

    if (!vpSchedule) {
      throw new BadRequestError("VP Schedule not found");
    }

    assertBranchAccess(req, vpSchedule.fromBranchId);

    if (vpSchedule.status === "CANCELLED") {
      throw new BadRequestError(
        "Cancelled VP Schedule cannot be used for VP Loading",
      );
    }

    if (!mrRr) {
      throw new BadRequestError("MR/RR not found");
    }

    if (mrRr.status === "CANCELLED") {
      throw new BadRequestError("Cancelled MR/RR cannot be used for VP Loading");
    }

    if (mrRr.vpScheduleId !== vpSchedule.id) {
      throw new BadRequestError("MR/RR does not belong to selected VP Schedule");
    }

    if (!mrRrRow) {
      throw new BadRequestError("MR/RR row not found");
    }

    if (mrRrRow.mrRrId !== mrRr.id) {
      throw new BadRequestError("MR/RR row does not belong to selected MR/RR");
    }

    if (!grn) {
      throw new BadRequestError("GRN not found");
    }

    if (grn.status !== "SUBMITTED") {
      throw new BadRequestError("Only submitted GRN can be used for VP Loading");
    }


    if (grn.lorryReceiptId !== data.lorryReceiptId) {
      throw new BadRequestError("Selected LR does not match selected GRN");
    }

    const alreadyLoadedInGRN = grn.vpLoadings.reduce(
      (sum, loading) => sum + loading.loadedQty,
      0,
    );

    const balanceQty = grn.receivedQty - alreadyLoadedInGRN;

    if (data.loadedQty > balanceQty) {
      throw new BadRequestError(
        `Loaded quantity cannot exceed GRN balance quantity (${balanceQty})`,
      );
    }

    const duplicate = await tx.vPLoading.findFirst({
      where: {
        mrRrRowId: data.mrRrRowId,
        lorryReceiptId: data.lorryReceiptId,
        deletedAt: null,
      },
      select: {
        id: true,
        loadingNumber: true,
      },
    });

    if (duplicate) {
      throw new ConflictError(
        `This LR is already linked with this VP row in ${duplicate.loadingNumber}`,
      );
    }

    const fyCode = fyCodeFor(new Date());

    const seq = await nextSequence(
      tx,
      vpSchedule.fromBranch.branchCode,
      fyCode,
      "VP_LOADING",
    );

    const loadingNumber = formatDocNumber(
      vpSchedule.fromBranch.branchCode,
      fyCode,
      seq,
      "VPL",
    );

    const moneyData = buildVPLoadingMoneyData(data);

    const row = await tx.vPLoading.create({
      data: {
        loadingNumber,

        vpScheduleId: data.vpScheduleId,
        mrRrId: data.mrRrId,
        mrRrRowId: data.mrRrRowId,
        lorryReceiptId: data.lorryReceiptId,
        grnId: data.grnId,

        status: "DRAFT",

        gateNo: data.gateNo ?? null,

        loadedQty: data.loadedQty,
        loadedCft: data.loadedCft,
        loadedWeightMt: toDecimalOrNull(data.loadedWeightMt),

        labourId: data.labourId ?? null,
        ...moneyData,

        loadingSupervisorId: data.loadingSupervisorId ?? null,

        loadingStartedAt: data.loadingStartedAt,
        loadingCompletedAt: data.loadingCompletedAt,

        remarks: data.remarks ?? null,

        createdById: me,
        updatedById: me,
      },
      include: vpLoadingDetailInclude,
    });

    return row;
  });

  return sendOk(res, created, undefined, 201);
});

/* ------------------------------------------------------------------ */
/* Update                                                             */
/* ------------------------------------------------------------------ */
router.patch("/:id", can(PERMS.VP_LOADING.UPDATE), async (req, res) => {
  const identifier = getVPLoadingIdentifier(req);

  const existing = await db.vPLoading.findFirst({
    where: vpLoadingWhereByIdentifier(identifier),
    include: {
      vpSchedule: {
        select: {
          fromBranchId: true,
        },
      },
    },
  });

  if (!existing) {
    throw new NotFoundError("VP Loading not found");
  }

  assertBranchAccess(req, existing.vpSchedule.fromBranchId);

  const clientVersion =
    typeof req.body?.version === "number" ? req.body.version : undefined;

  if (clientVersion !== undefined && clientVersion !== existing.version) {
    throw new ConflictError(
      "This VP Loading changed in another tab — reload and retry",
    );
  }

  if (existing.status !== "DRAFT") {
    throw new BadRequestError("Only draft VP Loading can be edited");
  }

  const parsed = updateVPLoadingSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;
  const me = actorId(req);

  const updated = await db.$transaction(async (tx) => {
    const [vpSchedule, mrRr, mrRrRow, grn] = await Promise.all([
      tx.vPSchedule.findFirst({
        where: {
          id: data.vpScheduleId,
          deletedAt: null,
        },
      }),

      tx.mRRR.findFirst({
        where: {
          id: data.mrRrId,
          deletedAt: null,
        },
      }),

      tx.mRRRRow.findFirst({
        where: {
          id: data.mrRrRowId,
        },
      }),

      tx.gRN.findFirst({
        where: {
          id: data.grnId,
          deletedAt: null,
        },
        include: {
          vpLoadings: {
            where: {
              deletedAt: null,
              status: "LOADED",
              id: {
                not: existing.id,
              },
            },
            select: {
              loadedQty: true,
            },
          },
        },
      }),
    ]);

    if (!vpSchedule) {
      throw new BadRequestError("VP Schedule not found");
    }

    assertBranchAccess(req, vpSchedule.fromBranchId);

    if (vpSchedule.status === "CANCELLED") {
      throw new BadRequestError(
        "Cancelled VP Schedule cannot be used for VP Loading",
      );
    }

    if (!mrRr) {
      throw new BadRequestError("MR/RR not found");
    }

    if (mrRr.status === "CANCELLED") {
      throw new BadRequestError("Cancelled MR/RR cannot be used for VP Loading");
    }

    if (mrRr.vpScheduleId !== vpSchedule.id) {
      throw new BadRequestError("MR/RR does not belong to selected VP Schedule");
    }

    if (!mrRrRow) {
      throw new BadRequestError("MR/RR row not found");
    }

    if (mrRrRow.mrRrId !== mrRr.id) {
      throw new BadRequestError("MR/RR row does not belong to selected MR/RR");
    }

    if (!grn) {
      throw new BadRequestError("GRN not found");
    }

    if (grn.status !== "SUBMITTED") {
      throw new BadRequestError("Only submitted GRN can be used for VP Loading");
    }

 

    if (grn.lorryReceiptId !== data.lorryReceiptId) {
      throw new BadRequestError("Selected LR does not match selected GRN");
    }

    const alreadyLoadedInGRN = grn.vpLoadings.reduce(
      (sum, loading) => sum + loading.loadedQty,
      0,
    );

    const balanceQty = grn.receivedQty - alreadyLoadedInGRN;

    if (data.loadedQty > balanceQty) {
      throw new BadRequestError(
        `Loaded quantity cannot exceed GRN balance quantity (${balanceQty})`,
      );
    }

    const duplicate = await tx.vPLoading.findFirst({
      where: {
        mrRrRowId: data.mrRrRowId,
        lorryReceiptId: data.lorryReceiptId,
        deletedAt: null,
        id: {
          not: existing.id,
        },
      },
      select: {
        id: true,
        loadingNumber: true,
      },
    });

    if (duplicate) {
      throw new ConflictError(
        `This LR is already linked with this VP row in ${duplicate.loadingNumber}`,
      );
    }

    const moneyData = buildVPLoadingMoneyData(data);

    const row = await tx.vPLoading.update({
      where: {
        id: existing.id,
      },
      data: {
        vpScheduleId: data.vpScheduleId,
        mrRrId: data.mrRrId,
        mrRrRowId: data.mrRrRowId,
        lorryReceiptId: data.lorryReceiptId,
        grnId: data.grnId,

        gateNo: data.gateNo ?? null,

        loadedQty: data.loadedQty,
        loadedCft: data.loadedCft,
        loadedWeightMt: toDecimalOrNull(data.loadedWeightMt),

        labourId: data.labourId ?? null,
        ...moneyData,

        loadingSupervisorId: data.loadingSupervisorId ?? null,

        loadingStartedAt: data.loadingStartedAt,
        loadingCompletedAt: data.loadingCompletedAt,

        remarks: data.remarks ?? null,

        updatedById: me,
        version: {
          increment: 1,
        },
      },
      include: vpLoadingDetailInclude,
    });

    return row;
  });

  return sendOk(res, updated);
});

/* ------------------------------------------------------------------ */
/* Mark Loaded                                                        */
/* ------------------------------------------------------------------ */
router.post(
  "/:id/mark-loaded",
  can(PERMS.VP_LOADING.MARK_LOADED),
  async (req, res) => {
    const identifier = getVPLoadingIdentifier(req);

    const existing = await db.vPLoading.findFirst({
      where: vpLoadingWhereByIdentifier(identifier),
      include: {
        vpSchedule: {
          select: {
            fromBranchId: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundError("VP Loading not found");
    }

    assertBranchAccess(req, existing.vpSchedule.fromBranchId);

    const parsed = markVPLoadedSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    if (
      parsed.data.version !== undefined &&
      parsed.data.version !== existing.version
    ) {
      throw new ConflictError(
        "This VP Loading changed in another tab — reload and retry",
      );
    }

    if (existing.status !== "DRAFT") {
      throw new BadRequestError("Only draft VP Loading can be marked as loaded");
    }

    if (existing.loadedQty <= 0) {
      throw new BadRequestError("Loaded quantity must be greater than zero");
    }

    const me = actorId(req);

    const updated = await db.vPLoading.update({
      where: {
        id: existing.id,
      },
      data: {
        status: "LOADED",
        loadingCompletedAt: existing.loadingCompletedAt ?? new Date(),
        updatedById: me,
        version: {
          increment: 1,
        },
      },
      include: vpLoadingDetailInclude,
    });

    return sendOk(res, updated);
  },
);

/* ------------------------------------------------------------------ */
/* Cancel                                                             */
/* ------------------------------------------------------------------ */
router.post("/:id/cancel", can(PERMS.VP_LOADING.CANCEL), async (req, res) => {
  const identifier = getVPLoadingIdentifier(req);

  const existing = await db.vPLoading.findFirst({
    where: vpLoadingWhereByIdentifier(identifier),
    include: {
      vpSchedule: {
        select: {
          fromBranchId: true,
        },
      },
    },
  });

  if (!existing) {
    throw new NotFoundError("VP Loading not found");
  }

  assertBranchAccess(req, existing.vpSchedule.fromBranchId);

  const parsed = cancelVPLoadingSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }

  if (
    parsed.data.version !== undefined &&
    parsed.data.version !== existing.version
  ) {
    throw new ConflictError(
      "This VP Loading changed in another tab — reload and retry",
    );
  }

  if (existing.status === "CANCELLED") {
    throw new BadRequestError("VP Loading is already cancelled");
  }

  const me = actorId(req);

  const updated = await db.vPLoading.update({
    where: {
      id: existing.id,
    },
    data: {
      status: "CANCELLED",
      cancelReason: parsed.data.reason,
      updatedById: me,
      version: {
        increment: 1,
      },
    },
    include: vpLoadingDetailInclude,
  });

  return sendOk(res, updated);
});

/* ------------------------------------------------------------------ */
/* Delete                                                             */
/* ------------------------------------------------------------------ */
router.delete("/:id", can(PERMS.VP_LOADING.DELETE), async (req, res) => {
  const identifier = getVPLoadingIdentifier(req);

  const existing = await db.vPLoading.findFirst({
    where: vpLoadingWhereByIdentifier(identifier),
    include: {
      vpSchedule: {
        select: {
          fromBranchId: true,
        },
      },
    },
  });

  if (!existing) {
    throw new NotFoundError("VP Loading not found");
  }

  assertBranchAccess(req, existing.vpSchedule.fromBranchId);

  if (!["DRAFT", "CANCELLED"].includes(existing.status)) {
    throw new BadRequestError(
      `A ${existing.status} VP Loading cannot be deleted. Cancel it first.`,
    );
  }

  const me = actorId(req);

  const deleted = await db.vPLoading.update({
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
    include: vpLoadingDetailInclude,
  });

  return sendOk(res, deleted);
});

export default router;