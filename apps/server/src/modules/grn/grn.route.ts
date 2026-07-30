import { Router } from "express";
import { PERMS } from "@skerp/types";
import {
  cancelGRNSchema,
  createGRNSchema,
  submitGRNSchema,
  updateGRNSchema,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { parseListQuery } from "../_shared/list.query.js";
import { sendOk } from "../_shared/response.js";
import { presignDownload } from "../../lib/s3.js";
import {
  buildGRNMoneyData,
  calculateGRNTotals,
  eligibleLRSelect,
  formatDocNumber,
  fyCodeFor,
  grnDetailInclude,
  grnRailheadBranchFilter,
  grnListSelect,
  grnPreviewInclude,
  nextSequence,
  toDecimalOrNull,
} from "./grn.service.js";
import { GRNStatus, Prisma } from "../../../generated/prisma/index.js";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../lib/error.js";

const router: Router = Router();

router.use(authMiddleware);

const DAMAGE_PHOTO_ENTITY = "GRN_DAMAGE";
const MAX_DAMAGE_PHOTO_BYTES = 2 * 1024 * 1024;

const actorId = (req: { user?: { userId: string } }) => {
  const userId = req.user?.userId;
  if (!userId) throw new BadRequestError("User context is missing");
  return userId;
};

const getIdParam = (value: string | string[] | undefined, label: string) => {
  const id = decodeURIComponent(
    Array.isArray(value) ? (value[0] ?? "") : (value ?? ""),
  ).trim();

  if (!id) throw new BadRequestError(`${label} is required`);
  return id;
};

const grnBranchFilter = (
  req: Parameters<typeof grnRailheadBranchFilter>[0],
): Prisma.GRNWhereInput => {
  const lrFilter = grnRailheadBranchFilter(req);
  return Object.keys(lrFilter).length
    ? { lorryReceipt: lrFilter as Prisma.LorryReceiptWhereInput }
    : {};
};

const grnWhereByIdentifier = (
  identifier: string,
  req: Parameters<typeof grnRailheadBranchFilter>[0],
): Prisma.GRNWhereInput => ({
  deletedAt: null,
  OR: [{ id: identifier }, { grnNumber: identifier }],
  ...grnBranchFilter(req),
});

const getDamagePhotos = (grnId: string) =>
  db.attachment.findMany({
    where: {
      entityType: DAMAGE_PHOTO_ENTITY,
      entityId: grnId,
      deletedAt: null,
    },
    orderBy: { uploadedAt: "desc" },
  });

type GRNGoodsLoadingSummary = {
  receivedQty: number;
  vpLoadingGoods?: {
    loadedQty: number;
    loadingDamageQty: number;
  }[];
};

const withLoadingAvailability = <
  T extends { goods?: GRNGoodsLoadingSummary[] },
>(
  grn: T,
) => ({
  ...grn,
  goods: grn.goods?.map((goods) => {
    const alreadyLoadedQty =
      goods.vpLoadingGoods?.reduce((sum, row) => sum + row.loadedQty, 0) ?? 0;
    const loadingDamageQty =
      goods.vpLoadingGoods?.reduce(
        (sum, row) => sum + row.loadingDamageQty,
        0,
      ) ?? 0;

    return {
      ...goods,
      alreadyLoadedQty,
      loadingDamageQty,
      availableQty: Math.max(goods.receivedQty - alreadyLoadedQty, 0),
    };
  }),
});

const withDamagePhotos = async <
  T extends { id: string; goods?: GRNGoodsLoadingSummary[] },
>(
  grn: T,
) => ({
  ...withLoadingAvailability(grn),
  damagePhotos: await getDamagePhotos(grn.id),
});

const validateDamagePhotoAttachments = async (
  grnId: string,
  attachmentIds: string[],
) => {
  if (attachmentIds.length === 0) return;

  const uniqueIds = [...new Set(attachmentIds)];
  const attachments = await db.attachment.findMany({
    where: {
      id: { in: uniqueIds },
      entityType: DAMAGE_PHOTO_ENTITY,
      entityId: grnId,
      deletedAt: null,
    },
  });

  if (attachments.length !== uniqueIds.length) {
    throw new BadRequestError(
      "One or more damage photo attachments do not belong to this GRN",
    );
  }

  for (const attachment of attachments) {
    if (!attachment.uploaded || attachment.antivirusStatus !== "CLEAN") {
      throw new BadRequestError("Damage photos must be uploaded and clean");
    }
    if (!attachment.mime.toLowerCase().startsWith("image/")) {
      throw new BadRequestError("Damage photos must be image files");
    }
    if (attachment.sizeBytes > MAX_DAMAGE_PHOTO_BYTES) {
      throw new BadRequestError("Damage photo must be less than 2 MB");
    }
  }
};

const getCreateLR = async (
  lrId: string,
  req: Parameters<typeof grnRailheadBranchFilter>[0],
) => {
  const lr = await db.lorryReceipt.findFirst({
    where: {
      id: lrId,
      deletedAt: null,
      ...grnRailheadBranchFilter(req),
      AND: [
        {
          group: {
            transportType: "RoadAndRail",
            railheadBranchId: { not: null },
          },
        },
      ],
    },
    include: {
      grn: { select: { id: true, grnNumber: true } },
      goods: { orderBy: { createdAt: "asc" } },
      group: {
        select: {
          id: true,
          railheadBranch: {
            select: { id: true, branchCode: true },
          },
        },
      },
    },
  });

  if (!lr) throw new NotFoundError("Lorry receipt not found");
  if (lr.status !== "FINALISED") {
    throw new BadRequestError("Only a FINALISED LR can be used to create GRN");
  }
  if (lr.grn) {
    throw new ConflictError(
      `GRN already exists for this LR: ${lr.grn.grnNumber}`,
    );
  }

  return lr;
};

const buildGoodsCreate = (
  lrGoods: Array<{
    id: string;
    quantity: number;
    quantityUnitId?: string | null;
    weightUnitId?: string | null;
  }>,
  goods: Array<{
    lrGoodsId?: string;
    goodsName: string;
    description?: string;
    totalQty: number;
    receivedQty: number;
    damageQty: number;
    shortageQty: number;
    quantityUnitId?: string;
    weightUnitId?: string;
    unit?: string;
    weight?: number;
    remarks?: string;
  }>,
) => {
  const lrGoodsById = new Map(lrGoods.map((row) => [row.id, row]));

  return goods.map((row) => {
    const source = row.lrGoodsId ? lrGoodsById.get(row.lrGoodsId) : undefined;

    if (row.lrGoodsId) {
      if (!source) {
        throw new BadRequestError(
          "GRN goods line does not belong to selected LR",
        );
      }
      if (row.totalQty > source.quantity) {
        throw new BadRequestError(
          `Total quantity cannot exceed LR goods quantity (${source.quantity})`,
        );
      }
    }

    return {
      lrGoodsId: row.lrGoodsId,
      goodsName: row.goodsName,
      description: row.description,
      totalQty: row.totalQty,
      receivedQty: row.receivedQty,
      damageQty: row.damageQty,
      shortageQty: row.shortageQty,
      quantityUnitId: row.quantityUnitId ?? source?.quantityUnitId ?? null,
      weightUnitId: row.weightUnitId ?? source?.weightUnitId ?? null,
      unit: row.unit,
      weight: toDecimalOrNull(row.weight),
      remarks: row.remarks,
    };
  });
};

const buildGRNWriteData = (
  data: ReturnType<typeof createGRNSchema.parse>,
  lrGoods: Array<{ id: string; quantity: number }>,
) => {
  const goods = buildGoodsCreate(lrGoods, data.goods);
  const money = buildGRNMoneyData(data);
  const totals = calculateGRNTotals(goods, money, data.detentionDays);

  return {
    gateNo: data.gateNo,
    inDateTime: data.inDateTime,
    outDateTime: data.outDateTime,
    unloadingMinutes: data.unloadingMinutes,

    totalWeightMt: toDecimalOrNull(data.totalWeightMt),
    ...money,
    detentionDays: data.detentionDays,
    damagesBy: data.damagesBy,
    lrCopyChecked: data.lrCopyChecked,
    invoiceChecked: data.invoiceChecked,
    kataReceiptChecked: data.kataReceiptChecked,
    wayBillChecked: data.wayBillChecked,
    sealNoChecked: data.sealNoChecked,
    lrCopyRemark: data.lrCopyRemark,
    invoiceRemark: data.invoiceRemark,
    kataReceiptRemark: data.kataReceiptRemark,
    wayBillRemark: data.wayBillRemark,
    sealNoRemark: data.sealNoRemark,
    labourId: data.labourId,
    labourName: data.labourName,
    unloadingSupervisorId: data.unloadingSupervisorId,
    remarks: data.remarks,
    ...totals,
    goods,
  };
};

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
    ...grnBranchFilter(req),
    ...(status ? { status } : {}),
    ...(query.search
      ? {
        OR: [
          {
            grnNumber: {
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
router.get("/status-counts", can(PERMS.GRN.VIEW), async (req, res) => {
  const grouped = await db.gRN.groupBy({
    by: ["status"],
    where: {
      deletedAt: null,
      ...grnBranchFilter(req),
    },
    _count: { _all: true },
  });

  const counts: Record<string, number> = {};
  let all = 0;

  for (const group of grouped) {
    counts[group.status] = group._count._all;
    all += group._count._all;
  }

  return sendOk(res, { all, ...counts });
});
// "/grn/supervisors"
router.get("/supervisors", can(PERMS.GRN.CREATE), async (req, res) => {
  const supervisorRole = await db.role.findFirst({
    where: {
      name: "SuperVisor",
    },
    select: {
      id: true,
    },
  });

  if (!supervisorRole) {
    return res.json({
      data: [],
    });
  }

  const supervisors = await db.user.findMany({
    where: {
      status: true,
      roleId: supervisorRole.id,

      ...(req.ctx?.branchScope === "ALL"
        ? {}
        : {
          branchId: {
            in: req.ctx?.branchIds ?? [],
          },
        }),
    },
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
      email: true,
    },
    orderBy: {
      firstName: "asc",
    },
  });

  res.json({
    data: supervisors.map((user) => ({
      id: user.id,
      name:
        [user.firstName, user.middleName, user.lastName]
          .filter(Boolean)
          .join(" ") || user.email,
      email: user.email,
    })),
  });
});
/* ------------------------------------------------------------------ */
/* Eligible LR dropdown                                                */
/* ------------------------------------------------------------------ */
router.get("/eligible-lrs", can(PERMS.GRN.CREATE), async (req, res) => {
  const query = parseListQuery(req);

  const branchWhere = grnRailheadBranchFilter(req);

  const where = {
    deletedAt: null,
    status: "FINALISED" as const,

    // LR should not already have GRN
    grn: { is: null },

    AND: [
      branchWhere,

      // GRN should allow only finalised LR group also
      {
        group: {
          status: "FINALISED" as const,
          transportType: "RoadAndRail",
        },
      },

      ...(query.search
        ? [
          {
            lrNumber: {
              contains: query.search,
              mode: "insensitive" as const,
            },
          },
        ]
        : []),
    ],
  } satisfies Prisma.LorryReceiptWhereInput;

  const [data, total] = await Promise.all([
    db.lorryReceipt.findMany({
      where,
      skip: query.page * query.size,
      take: query.size,
      select: eligibleLRSelect,
      orderBy: { createdAt: "desc" },
    }),
    db.lorryReceipt.count({ where }),
  ]);

  return sendOk(res, data, {
    page: query.page,
    size: query.size,
    total,
  });
});

router.get(
  "/:grnId/damage-photos/:photoId/view-url",
  can(PERMS.GRN.VIEW),
  async (req, res) => {
    const grnId = getIdParam(req.params.grnId, "GRN identifier");
    const photoId = getIdParam(req.params.photoId, "Damage photo identifier");

    const grn = await db.gRN.findFirst({
      where: grnWhereByIdentifier(grnId, req),
      select: {
        id: true,
      },
    });

    if (!grn) throw new NotFoundError("GRN not found");

    const photo = await db.attachment.findFirst({
      where: {
        id: photoId,
        entityType: "GRN_DAMAGE",
        entityId: grn.id,
        uploaded: true,
        deletedAt: null,
      },
      select: {
        id: true,
        s3Key: true,
        mime: true,
        originalName: true,
        antivirusStatus: true,
      },
    });

    if (!photo) throw new NotFoundError("Damage photo not found");

    if (photo.antivirusStatus !== "CLEAN") {
      throw new Error("Damage photo is not available yet.");
    }

    if (!photo.s3Key) {
      throw new Error("Damage photo file path is missing.");
    }

    const viewUrl = await presignDownload(photo.s3Key);

    return sendOk(res, {
      viewUrl,
    });
  },
);
/* ------------------------------------------------------------------ */
/* GRN preview from selected LR                                        */
/* ------------------------------------------------------------------ */
router.get("/preview/:lrId", can(PERMS.GRN.CREATE), async (req, res) => {
  const lrId = getIdParam(req.params.lrId, "LR id");

  const lr = await db.lorryReceipt.findFirst({
    where: {
      id: lrId,
      deletedAt: null,

      // Source railhead branch scope
      ...grnRailheadBranchFilter(req),
      AND: [
        {
          group: {
            transportType: "RoadAndRail",
            railheadBranchId: { not: null },
          },
        },
      ],
    },
    include: grnPreviewInclude,
  });

  if (!lr) {
    throw new NotFoundError("Lorry receipt not found");
  }

  if (lr.status !== "FINALISED") {
    throw new BadRequestError("Only a FINALISED LR can be used to create GRN");
  }

  if (lr.grn) {
    throw new BadRequestError("GRN already exists for this LR");
  }

  const group = lr.group;

  const ownTrip = group.primaryTrip ?? group.secondaryTrip ?? null;

  const vehicleInfo = group.isMarketVehicle
    ? {
      type: "MARKET" as const,
      vehicleNumber: group.marketVehicleNumber,
      driverName: group.marketDriverName,
      driverMobile: null,
      tripNumber: null,
      tripName: null,
    }
    : {
      type: "OWN" as const,
      vehicleNumber: ownTrip?.vehicle?.vehicleNumber ?? null,
      driverName: ownTrip?.driver?.name ?? null,
      driverMobile: ownTrip?.driver?.mobile ?? null,
      tripNumber: ownTrip?.tripNumber ?? null,
      tripName: ownTrip?.tripName ?? null,
    };

  const chargeDefaults = group.isMarketVehicle
    ? {
      totalFreight: group.marketFreightAmount,
      advanceAmount: group.marketAdvanceAmount,
      hamaliAmount: group.marketHamaliAmount,
      tdsAmount: group.marketTdsAmount,
      commissionAmount: group.marketCommissionAmount,
    }
    : {
      totalFreight: group.baseFreightAmount ?? ownTrip?.onwardFreight ?? null,
      advanceAmount: 0,
      hamaliAmount: 0,
      tdsAmount: 0,
      commissionAmount: 0,
    };

  const goods = lr.goods.map((g) => ({
    lrGoodsId: g.id,
    goodsName: g.name,
    description: g.description,
    totalQty: g.quantity,

    // Default full received.
    // User can change this and enter damage / shortage.
    receivedQty: g.quantity,
    damageQty: 0,
    shortageQty: 0,

    quantityUnitId: g.quantityUnitId,
    weightUnitId: g.weightUnitId,
    quantityUnit: g.quantityUnit,
    weightUnit: g.weightUnit,
    unit: g.unit,
    weight: g.weight,
    remarks: "",
  }));

  const totalQty = goods.reduce((sum, g) => sum + g.totalQty, 0);

  return sendOk(res, {
    lorryReceipt: {
      id: lr.id,
      lrNumber: lr.lrNumber,
      status: lr.status,
      fyCode: lr.fyCode,
      createdAt: lr.createdAt,
      invoiceNumber: lr.invoiceNumber,
      invoiceAmount: lr.invoiceAmount,

      totalWeight:
        lr.totalWeight == null ? null : Number(lr.totalWeight),
      unit: lr.unit,
      sealNumber: group.sealNumber,

      loadingLocation: lr.loadingLocation,
      unloadingLocation: lr.unloadingLocation,
      ewayBill: lr.ewayBill,
      group: lr.group,
    },
    vehicleInfo,
    chargeDefaults,
    goods,
    totals: {
      totalQty,
    },
  });
});

/* ------------------------------------------------------------------ */
/* Detail                                                             */
/* ------------------------------------------------------------------ */
router.get("/:id", can(PERMS.GRN.VIEW), async (req, res) => {
  const identifier = getIdParam(req.params.id, "GRN identifier");

  const grn = await db.gRN.findFirst({
    where: grnWhereByIdentifier(identifier, req),
    include: grnDetailInclude,
  });

  if (!grn) throw new NotFoundError("GRN not found");

  return sendOk(res, await withDamagePhotos(grn));
});

/* ------------------------------------------------------------------ */
/* Create draft                                                       */
/* ------------------------------------------------------------------ */
router.post("/", can(PERMS.GRN.CREATE), async (req, res) => {
  const parsed = createGRNSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError(parsed.error.flatten());

  const input = parsed.data;
  const lr = await getCreateLR(input.lorryReceiptId, req);
  const writeData = buildGRNWriteData(input, lr.goods);
  const userId = actorId(req);
  const fyCode = lr.fyCode || fyCodeFor(new Date());
  const railheadBranch = lr.group.railheadBranch;
  if (!railheadBranch) {
    throw new BadRequestError(
      "The Road & Rail LR does not have a railhead branch",
    );
  }
  const branchCode = railheadBranch.branchCode;

  const grn = await db.$transaction(async (tx) => {
    const seq = await nextSequence(tx, branchCode, fyCode, "GRN");
    const grnNumber = formatDocNumber(branchCode, fyCode, seq, "SKN");

    return tx.gRN.create({
      data: {
        grnNumber,
        lorryReceiptId: input.lorryReceiptId,
        createdById: userId,
        gateNo: writeData.gateNo,
        inDateTime: writeData.inDateTime,
        outDateTime: writeData.outDateTime,
        unloadingMinutes: writeData.unloadingMinutes,
        totalQty: writeData.totalQty,
        receivedQty: writeData.receivedQty,
        damageQty: writeData.damageQty,
        shortageQty: writeData.shortageQty,
        totalWeightMt: writeData.totalWeightMt,
        totalFreight: writeData.totalFreight,
        balanceFreight: writeData.balanceFreight,
        freightPerMt: writeData.freightPerMt,
        detentionDays: writeData.detentionDays,
        detentionRate: writeData.detentionRate,
        detentionAmount: writeData.detentionAmount,
        grossTotal: writeData.grossTotal,
        advanceAmount: writeData.advanceAmount,
        damageAmount: writeData.damageAmount,
        tdsAmount: writeData.tdsAmount,
        hamaliAmount: writeData.hamaliAmount,
        printingStationaryAmount: writeData.printingStationaryAmount,
        netAmount: writeData.netAmount,
        labourId: writeData.labourId,
        labourName: writeData.labourName,
        labourCharge: writeData.labourCharge,
        unloadingSupervisorId: writeData.unloadingSupervisorId,
        damagesBy: writeData.damagesBy,
        lrCopyChecked: writeData.lrCopyChecked,
        invoiceChecked: writeData.invoiceChecked,
        kataReceiptChecked: writeData.kataReceiptChecked,
        wayBillChecked: writeData.wayBillChecked,
        sealNoChecked: writeData.sealNoChecked,
        lrCopyRemark: writeData.lrCopyRemark,
        invoiceRemark: writeData.invoiceRemark,
        kataReceiptRemark: writeData.kataReceiptRemark,
        wayBillRemark: writeData.wayBillRemark,
        sealNoRemark: writeData.sealNoRemark,
        remarks: writeData.remarks,
        goods: { create: writeData.goods },
      },
      include: grnDetailInclude,
    });
  });

  return sendOk(res, await withDamagePhotos(grn), undefined, 201);
});

/* ------------------------------------------------------------------ */
/* Update draft                                                       */
/* ------------------------------------------------------------------ */
router.put("/:id", can(PERMS.GRN.UPDATE), async (req, res) => {
  const identifier = getIdParam(req.params.id, "GRN identifier");
  const parsed = updateGRNSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError(parsed.error.flatten());

  const input = parsed.data;
  const existing = await db.gRN.findFirst({
    where: grnWhereByIdentifier(identifier, req),
    include: {
      lorryReceipt: {
        include: {
          goods: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });

  if (!existing) throw new NotFoundError("GRN not found");
  if (!["DRAFT", "SUBMITTED"].includes(existing.status)) {
    throw new BadRequestError("Only a DRAFT or SUBMITTED GRN can be updated");
  }
  if (input.version !== undefined && input.version !== existing.version) {
    throw new ConflictError("GRN was updated by someone else. Please refresh.");
  }
  if (input.lorryReceiptId !== existing.lorryReceiptId) {
    throw new BadRequestError("LR cannot be changed after GRN is created");
  }

  const writeData = buildGRNWriteData(input, existing.lorryReceipt.goods);

  const grn = await db.$transaction(async (tx) => {
    await tx.gRNGoods.deleteMany({ where: { grnId: existing.id } });

    return tx.gRN.update({
      where: { id: existing.id },
      data: {
        updatedById: actorId(req),
        version: { increment: 1 },
        gateNo: writeData.gateNo,
        inDateTime: writeData.inDateTime,
        outDateTime: writeData.outDateTime,
        unloadingMinutes: writeData.unloadingMinutes,
        totalQty: writeData.totalQty,
        receivedQty: writeData.receivedQty,
        damageQty: writeData.damageQty,
        shortageQty: writeData.shortageQty,
        totalWeightMt: writeData.totalWeightMt,
        totalFreight: writeData.totalFreight,
        balanceFreight: writeData.balanceFreight,
        freightPerMt: writeData.freightPerMt,
        detentionDays: writeData.detentionDays,
        detentionRate: writeData.detentionRate,
        detentionAmount: writeData.detentionAmount,
        grossTotal: writeData.grossTotal,
        advanceAmount: writeData.advanceAmount,
        damageAmount: writeData.damageAmount,
        tdsAmount: writeData.tdsAmount,
        hamaliAmount: writeData.hamaliAmount,
        printingStationaryAmount: writeData.printingStationaryAmount,
        netAmount: writeData.netAmount,
        labourId: writeData.labourId,
        labourName: writeData.labourName,
        labourCharge: writeData.labourCharge,
        unloadingSupervisorId: writeData.unloadingSupervisorId,
        damagesBy: writeData.damagesBy,
        lrCopyChecked: writeData.lrCopyChecked,
        invoiceChecked: writeData.invoiceChecked,
        kataReceiptChecked: writeData.kataReceiptChecked,
        wayBillChecked: writeData.wayBillChecked,
        sealNoChecked: writeData.sealNoChecked,
        lrCopyRemark: writeData.lrCopyRemark,
        invoiceRemark: writeData.invoiceRemark,
        kataReceiptRemark: writeData.kataReceiptRemark,
        wayBillRemark: writeData.wayBillRemark,
        sealNoRemark: writeData.sealNoRemark,
        remarks: writeData.remarks,
        goods: { create: writeData.goods },
      },
      include: grnDetailInclude,
    });
  });

  await validateDamagePhotoAttachments(grn.id, input.damagePhotoAttachmentIds);

  return sendOk(res, await withDamagePhotos(grn));
});

/* ------------------------------------------------------------------ */
/* Submit                                                             */
/* ------------------------------------------------------------------ */
router.post("/:id/submit", can(PERMS.GRN.SUBMIT), async (req, res) => {
  const identifier = getIdParam(req.params.id, "GRN identifier");
  const parsed = submitGRNSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError(parsed.error.flatten());

  const existing = await db.gRN.findFirst({
    where: grnWhereByIdentifier(identifier, req),
    include: { goods: true },
  });

  if (!existing) throw new NotFoundError("GRN not found");
  if (existing.status !== "DRAFT") {
    throw new BadRequestError("Only a DRAFT GRN can be submitted");
  }
  if (
    parsed.data.version !== undefined &&
    parsed.data.version !== existing.version
  ) {
    throw new ConflictError("GRN was updated by someone else. Please refresh.");
  }
  if (existing.goods.length === 0 || existing.receivedQty <= 0) {
    throw new BadRequestError("Add received goods before submitting GRN");
  }
  if (
    existing.damageQty > 0 &&
    parsed.data.damagePhotoAttachmentIds.length === 0
  ) {
    throw new BadRequestError(
      "Damage photo is required when damage quantity is entered",
    );
  }

  await validateDamagePhotoAttachments(
    existing.id,
    parsed.data.damagePhotoAttachmentIds,
  );

  const grn = await db.gRN.update({
    where: { id: existing.id },
    data: {
      status: "SUBMITTED",
      updatedById: actorId(req),
      version: { increment: 1 },
    },
    include: grnDetailInclude,
  });

  return sendOk(res, await withDamagePhotos(grn));
});

/* ------------------------------------------------------------------ */
/* Cancel                                                             */
/* ------------------------------------------------------------------ */
router.post("/:id/cancel", can(PERMS.GRN.CANCEL), async (req, res) => {
  const identifier = getIdParam(req.params.id, "GRN identifier");
  const parsed = cancelGRNSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError(parsed.error.flatten());

  const existing = await db.gRN.findFirst({
    where: grnWhereByIdentifier(identifier, req),
    include: { vpLoadings: { select: { id: true } } },
  });

  if (!existing) throw new NotFoundError("GRN not found");
  if (existing.status === "CANCELLED") {
    throw new BadRequestError("GRN is already cancelled");
  }
  if (
    parsed.data.version !== undefined &&
    parsed.data.version !== existing.version
  ) {
    throw new ConflictError("GRN was updated by someone else. Please refresh.");
  }
  if (existing.vpLoadings.length > 0) {
    throw new BadRequestError(
      "GRN cannot be cancelled after VP Loading is created",
    );
  }

  const grn = await db.gRN.update({
    where: { id: existing.id },
    data: {
      status: "CANCELLED",
      cancelReason: parsed.data.reason,
      updatedById: actorId(req),
      version: { increment: 1 },
    },
    include: grnDetailInclude,
  });

  return sendOk(res, await withDamagePhotos(grn));
});

export default router;
