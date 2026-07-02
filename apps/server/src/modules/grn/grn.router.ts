import { Router } from "express";

import {
  createGRNSchema,
  updateGRNSchema,
  submitGRNSchema,
  cancelGRNSchema,
} from "@skerp/validators";
import { PERMS } from "@skerp/types";

import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import {  assertBranchAccess } from "../../auth/branch-scope.js";
import { parseListQuery } from "../_shared/list.query.js";
import { sendOk } from "../_shared/response.js";

import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../lib/error.js";

import {
  grnListSelect,
  grnDetailInclude,
  grnPreviewLRInclude,
  fyCodeFor,
  nextSequence,
  formatDocNumber,
  calculateUnloadingMinutes,
  calculateGRNGoodsTotals,
  buildGRNMoneyData,
  buildGRNGoodsCreateData,
} from "./grn.service.js";
import { Prisma, GRNStatus } from "../../../generated/prisma/index.js";

const router: Router = Router();

router.use(authMiddleware);

const actorId = (req: { user?: { userId: string } }) => req.user!.userId;

const getGRNIdentifier = (req: { params: { id?: string | string[] } }) => {
  const rawId = req.params.id;

  const identifier = decodeURIComponent(
    Array.isArray(rawId) ? rawId[0] ?? "" : rawId ?? "",
  ).trim();

  if (!identifier) {
    throw new BadRequestError("GRN identifier is required");
  }

  return identifier;
};

const grnWhereByIdentifier = (identifier: string) => ({
  deletedAt: null,
  OR: [{ id: identifier }, { grnNumber: identifier }],
});
/* ------------------------------------------------------------------ */
/* List                                                               */
/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/* List                                                               */
/* ------------------------------------------------------------------ */
router.get("/", can(PERMS.GRN.VIEW), async (req, res) => {
  const query = parseListQuery(req);

  const status =
    typeof query.filter.status === "string" &&
    Object.values(GRNStatus).includes(query.filter.status as GRNStatus)
      ? (query.filter.status as GRNStatus)
      : undefined;



  const where: Prisma.GRNWhereInput = {
    deletedAt: null,

    ...(status ? { status } : {}),

   

    ...(query.search
      ? {
          OR: [
            {
              grnNumber: {
                contains: query.search,
                mode: "insensitive",
              },
            },
            {
              gateNo: {
                contains: query.search,
                mode: "insensitive",
              },
            },
            {
              lorryReceipt: {
                lrNumber: {
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
    db.gRN.findMany({
      where,
      skip: query.page * query.size,
      take: query.size,
      select: grnListSelect,
      orderBy: query.sort
        ? { [query.sort.field]: query.sort.direction }
        : { createdAt: "desc" },
    }),

    db.gRN.count({ where }),
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
router.get("/status-counts", can(PERMS.GRN.VIEW), async (_req, res) => {
  const base: Prisma.GRNWhereInput = {
    deletedAt: null,
  };

  const grouped = await db.gRN.groupBy({
    by: ["status"],
    where: base,
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
/* LR preview for GRN creation                                        */
/* ------------------------------------------------------------------ */
router.get(
  "/preview/lr/:lorryReceiptId",
  can(PERMS.GRN.CREATE),
  async (req, res) => {
   const rawLorryReceiptId = req.params.lorryReceiptId;

const lorryReceiptId = decodeURIComponent(
  Array.isArray(rawLorryReceiptId)
    ? rawLorryReceiptId[0] ?? ""
    : rawLorryReceiptId ?? "",
).trim();

    if (!lorryReceiptId) {
      throw new BadRequestError("LR is required");
    }

    const lr = await db.lorryReceipt.findFirst({
      where: {
        deletedAt: null,
        OR: [{ id: lorryReceiptId }, { lrNumber: lorryReceiptId }],
      },
      include: grnPreviewLRInclude,
    });

    if (!lr) {
      throw new NotFoundError("LR not found");
    }

    if (lr.status !== "FINALISED") {
      throw new BadRequestError("Only a finalised LR can be used for GRN");
    }

    const existingGRN = await db.gRN.findFirst({
  where: {
    lorryReceiptId: lr.id,
    deletedAt: null,
  },
  select: {
    id: true,
    grnNumber: true,
    status: true,
  },
});

    if (existingGRN) {
      throw new ConflictError(
        `GRN already exists for this LR: ${existingGRN.grnNumber}`,
      );
    }

    return sendOk(res, {
      lorryReceipt: {
        id: lr.id,
        lrNumber: lr.lrNumber,
        status: lr.status,
        invoiceNumber: lr.invoiceNumber,
        invoiceAmount: lr.invoiceAmount,
      },

      group: lr.group
        ? {
            id: lr.group.id,
            groupNumber: lr.group.groupNumber,
            transportType: lr.group.transportType,
            originBranch: lr.group.originBranch,
            destinationBranch: lr.group.destinationBranch,
            consignor: lr.group.consignor,
            consignee: lr.group.consignee,
          }
        : null,

      goods: lr.goods.map((item) => ({
        lrGoodsId: item.id,
        goodsName: item.name,
        description: item.description,
        totalQty: item.quantity,
        unit: item.unit,
        weight: item.weight,
      })),

      ewayBill: lr.ewayBill,
    });
  },
);
/* ------------------------------------------------------------------ */
/* Detail                                                             */
/* ------------------------------------------------------------------ */
router.get("/:id", can(PERMS.GRN.VIEW), async (req, res) => {
  const identifier = getGRNIdentifier(req);

  const grn = await db.gRN.findFirst({
    where: grnWhereByIdentifier(identifier),
    include: grnDetailInclude,
  });

  if (!grn) {
    throw new NotFoundError("GRN not found");
  }



  return sendOk(res, grn);
});
/* ------------------------------------------------------------------ */
/* Create                                                             */
/* ------------------------------------------------------------------ */
router.post("/", can(PERMS.GRN.CREATE), async (req, res) => {
  const parsed = createGRNSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;
  const me = actorId(req);

  const created = await db.$transaction(async (tx) => {
    const lr = await tx.lorryReceipt.findFirst({
      where: {
        id: data.lorryReceiptId,
        deletedAt: null,
      },
      select: {
        id: true,
        lrNumber: true,
        status: true,
        grn: {
          select: {
            id: true,
            grnNumber: true,
          },
        },
        group: {
          select: {
            destinationBranchId: true,
            destinationBranch: {
              select: {
                id: true,
                branchCode: true,
              },
            },
          },
        },
      },
    });

    if (!lr) {
      throw new BadRequestError("LR not found");
    }

    if (lr.status !== "FINALISED") {
      throw new BadRequestError("Only a finalised LR can be used for GRN");
    }

    if (lr.grn) {
      throw new ConflictError(`GRN already exists for LR ${lr.lrNumber}`);
    }

    if (!lr.group?.destinationBranchId) {
      throw new BadRequestError("LR destination branch is required for GRN");
    }

    if (!lr.group.destinationBranch?.branchCode) {
      throw new BadRequestError("LR destination branch code is required for GRN number");
    }

    assertBranchAccess(req, lr.group.destinationBranchId);

    const fyCode = fyCodeFor(new Date());
    const branchCode = lr.group.destinationBranch.branchCode;

    const seq = await nextSequence(tx, branchCode, fyCode, "GRN");
    const grnNumber = formatDocNumber(branchCode, fyCode, seq, "GRN");

    const totals = calculateGRNGoodsTotals(data.goods);
    const moneyData = buildGRNMoneyData(data);

    return tx.gRN.create({
      data: {
        grnNumber,

        lorryReceiptId: data.lorryReceiptId,

        status: "DRAFT",

        gateNo: data.gateNo ?? null,

        inDateTime: data.inDateTime,
        outDateTime: data.outDateTime,
        unloadingMinutes: calculateUnloadingMinutes(
          data.inDateTime,
          data.outDateTime,
        ),

        totalQty: totals.totalQty,
        receivedQty: totals.receivedQty,
        damageQty: totals.damageQty,
        shortageQty: totals.shortageQty,
        totalWeightMt: new Prisma.Decimal(totals.totalWeightMt),

        ...moneyData,

        detentionDays: data.detentionDays ?? 0,

        labourId: data.labourId ?? null,
        labourCharge: moneyData.hamaliAmount,

        unloadingSupervisorId: data.unloadingSupervisorId ?? null,

        damagesBy: data.damagesBy ?? "NONE",

        lrCopyChecked: data.lrCopyChecked,
        invoiceChecked: data.invoiceChecked,
        kataReceiptChecked: data.kataReceiptChecked,
        wayBillChecked: data.wayBillChecked,
        sealNoChecked: data.sealNoChecked,

        lrCopyRemark: data.lrCopyRemark ?? null,
        invoiceRemark: data.invoiceRemark ?? null,
        kataReceiptRemark: data.kataReceiptRemark ?? null,
        wayBillRemark: data.wayBillRemark ?? null,
        sealNoRemark: data.sealNoRemark ?? null,

        remarks: data.remarks ?? null,

        createdById: me,
        updatedById: me,

        goods: {
          create: buildGRNGoodsCreateData(data.goods),
        },
      },
      include: grnDetailInclude,
    });
  });

  return sendOk(res, created, undefined, 201);
});
/* ------------------------------------------------------------------ */
/* Update                                                             */
/* ------------------------------------------------------------------ */
router.patch("/:id", can(PERMS.GRN.UPDATE), async (req, res) => {
  const identifier = getGRNIdentifier(req);

  const existing = await db.gRN.findFirst({
    where: grnWhereByIdentifier(identifier),

  });

  if (!existing) {
    throw new NotFoundError("GRN not found");
  }



  const clientVersion =
    typeof req.body?.version === "number" ? req.body.version : undefined;

  if (clientVersion !== undefined && clientVersion !== existing.version) {
    throw new ConflictError("This GRN changed in another tab — reload and retry");
  }

  if (existing.status !== "DRAFT") {
    throw new BadRequestError("Only a draft GRN can be edited");
  }

  const parsed = updateGRNSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;
  const me = actorId(req);
const updated = await db.$transaction(async (tx) => {
  const lr = await tx.lorryReceipt.findFirst({
    where: {
      id: data.lorryReceiptId,
      deletedAt: null,
    },
    select: {
      id: true,
      lrNumber: true,
      status: true,
      grn: {
        select: {
          id: true,
        },
      },
      group: {
        select: {
          destinationBranchId: true,
          destinationBranch: {
            select: {
              id: true,
              branchCode: true,
            },
          },
        },
      },
    },
  });

  if (!lr) {
    throw new BadRequestError("LR not found");
  }

  if (lr.status !== "FINALISED") {
    throw new BadRequestError("Only a finalised LR can be used for GRN");
  }

  if (lr.grn && lr.grn.id !== existing.id) {
    throw new ConflictError("Another GRN already exists for this LR");
  }

  if (!lr.group?.destinationBranchId) {
    throw new BadRequestError("LR destination branch is required for GRN");
  }

  assertBranchAccess(req, lr.group.destinationBranchId);

  const totals = calculateGRNGoodsTotals(data.goods);
  const moneyData = buildGRNMoneyData(data);

  await tx.gRNGoods.deleteMany({
    where: {
      grnId: existing.id,
    },
  });

  return tx.gRN.update({
    where: {
      id: existing.id,
    },
    data: {
      lorryReceiptId: data.lorryReceiptId,

      gateNo: data.gateNo ?? null,

      inDateTime: data.inDateTime,
      outDateTime: data.outDateTime,
      unloadingMinutes: calculateUnloadingMinutes(
        data.inDateTime,
        data.outDateTime,
      ),

      totalQty: totals.totalQty,
      receivedQty: totals.receivedQty,
      damageQty: totals.damageQty,
      shortageQty: totals.shortageQty,
      totalWeightMt: new Prisma.Decimal(totals.totalWeightMt),

      ...moneyData,

      detentionDays: data.detentionDays ?? 0,

      labourId: data.labourId ?? null,
      labourCharge: moneyData.hamaliAmount,

      unloadingSupervisorId: data.unloadingSupervisorId ?? null,

      damagesBy: data.damagesBy ?? "NONE",

      lrCopyChecked: data.lrCopyChecked,
      invoiceChecked: data.invoiceChecked,
      kataReceiptChecked: data.kataReceiptChecked,
      wayBillChecked: data.wayBillChecked,
      sealNoChecked: data.sealNoChecked,

      lrCopyRemark: data.lrCopyRemark ?? null,
      invoiceRemark: data.invoiceRemark ?? null,
      kataReceiptRemark: data.kataReceiptRemark ?? null,
      wayBillRemark: data.wayBillRemark ?? null,
      sealNoRemark: data.sealNoRemark ?? null,

      remarks: data.remarks ?? null,

      updatedById: me,
      version: {
        increment: 1,
      },

      goods: {
        create: buildGRNGoodsCreateData(data.goods),
      },
    },
    include: grnDetailInclude,
  });
});

  return sendOk(res, updated);
});
/* ------------------------------------------------------------------ */
/* Submit                                                             */
/* ------------------------------------------------------------------ */
router.post("/:id/submit", can(PERMS.GRN.SUBMIT), async (req, res) => {
  const identifier = getGRNIdentifier(req);

  const existing = await db.gRN.findFirst({
    where: grnWhereByIdentifier(identifier),
    include: {

      goods: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!existing) {
    throw new NotFoundError("GRN not found");
  }



  const parsed = submitGRNSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }

  const clientVersion = parsed.data.version;

  if (clientVersion !== undefined && clientVersion !== existing.version) {
    throw new ConflictError("This GRN changed in another tab — reload and retry");
  }

  if (existing.status !== "DRAFT") {
    throw new BadRequestError("Only a draft GRN can be submitted");
  }

  if (existing.goods.length === 0) {
    throw new BadRequestError("Add at least one goods line before submitting");
  }

  if (existing.receivedQty <= 0) {
    throw new BadRequestError("Received quantity must be greater than zero");
  }

  const me = actorId(req);

  const updated = await db.gRN.update({
    where: {
      id: existing.id,
    },
    data: {
      status: "SUBMITTED",
      updatedById: me,
      version: {
        increment: 1,
      },
    },
    include: grnDetailInclude,
  });

  return sendOk(res, updated);
});
/* ------------------------------------------------------------------ */
/* Cancel                                                             */
/* ------------------------------------------------------------------ */
router.post("/:id/cancel", can(PERMS.GRN.CANCEL), async (req, res) => {
  const identifier = getGRNIdentifier(req);

  const existing = await db.gRN.findFirst({
    where: grnWhereByIdentifier(identifier),
    include: {
      goods: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!existing) {
    throw new NotFoundError("GRN not found");
  }

  const parsed = cancelGRNSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;

  if (data.version !== undefined && data.version !== existing.version) {
    throw new ConflictError("This GRN changed in another tab — reload and retry");
  }

  if (existing.status === "CANCELLED") {
    throw new BadRequestError("GRN is already cancelled");
  }

  if (!["DRAFT", "SUBMITTED"].includes(existing.status)) {
    throw new BadRequestError(`A ${existing.status} GRN cannot be cancelled`);
  }

  const vpLoadingCount = await db.vPLoading.count({
    where: {
      grnId: existing.id,
      deletedAt: null,
    },
  });

  if (vpLoadingCount > 0) {
    throw new BadRequestError(
      `This GRN cannot be cancelled because ${vpLoadingCount} VP loading record(s) are linked with it.`,
    );
  }

  const me = actorId(req);

  const cancelled = await db.gRN.update({
    where: {
      id: existing.id,
    },
    data: {
      status: "CANCELLED",
      cancelReason: data.reason,
      updatedById: me,
      version: {
        increment: 1,
      },
    },
    include: grnDetailInclude,
  });

  return sendOk(res, cancelled);
});

/* ------------------------------------------------------------------ */
/* Delete                                                             */
/* ------------------------------------------------------------------ */
router.delete("/:id", can(PERMS.GRN.DELETE), async (req, res) => {
  const identifier = getGRNIdentifier(req);

const existing = await db.gRN.findFirst({
  where: grnWhereByIdentifier(identifier),
});
  if (!existing) {
    throw new NotFoundError("GRN not found");
  }

  if (!["DRAFT", "CANCELLED"].includes(existing.status)) {
    throw new BadRequestError(
      `A ${existing.status} GRN cannot be deleted. Cancel it first.`,
    );
  }

  const vpLoadingCount = await db.vPLoading.count({
    where: {
      grnId: existing.id,
      deletedAt: null,
    },
  });

  if (vpLoadingCount > 0) {
    throw new BadRequestError(
      `This GRN cannot be deleted because ${vpLoadingCount} VP loading record(s) are linked with it.`,
    );
  }

  const me = actorId(req);

  const deleted = await db.gRN.update({
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
    include: grnDetailInclude,
  });

  return sendOk(res, deleted);
});
export default router;