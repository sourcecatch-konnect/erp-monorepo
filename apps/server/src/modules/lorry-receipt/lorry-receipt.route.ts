import { Router } from "express";
import { updateLRSchema, addEwayBillSchema } from "@skerp/validators";
import { PERMS } from "@skerp/types";

import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { parseListQuery } from "../_shared/list.query.js";
import { sendOk } from "../_shared/response.js";
import { getParamId } from "../_shared/param.js";
import { assertBranchAccess } from "../../auth/branch-scope.js";
import {
  BadRequestError,
  NotFoundError,
  ValidationError,
} from "../../lib/error.js";
import type { LRStatus } from "../../../generated/prisma/index.js";
import { lrListSelect, lrDetailInclude } from "./lorry-receipt.service.js";

const router: Router = Router();
router.use(authMiddleware);

const actorId = (req: { user?: { userId: string } }) => req.user!.userId;

/**
 * LR-level branch access is enforced via its group's origin branch. An LR is a
 * single consignment within an LRGroup; creation, finalise, hub-split and cancel
 * are all group-level actions (see modules/lr-group). This router only exposes
 * read + the per-LR draft edits (location/goods/invoice) and extra e-way bills.
 */
const lrBranchFilter = (req: Parameters<typeof assertBranchAccess>[0]) => {
  if (!req.ctx) return {};
  if (req.ctx.branchScope === "ALL") return {};
  if (req.ctx.branchIds.length === 0) {
    return { id: { in: [] as string[] } };
  }
  return {
    group: {
      OR: [
        { originBranchId: { in: req.ctx.branchIds } },
        { destinationBranchId: { in: req.ctx.branchIds } },
      ],
    },
  };
};

/* ------------------------------------------------------------------ */
/* List                                                                */
/* ------------------------------------------------------------------ */
router.get("/", can(PERMS.LORRY_RECEIPT.VIEW), async (req, res) => {
  const query = parseListQuery(req);
  const where = {
    deletedAt: null,
    ...lrBranchFilter(req),
    ...(query.filter.status ? { status: query.filter.status as LRStatus } : {}),
    ...(query.filter.groupId ? { groupId: query.filter.groupId } : {}),
    ...(query.search
      ? { lrNumber: { contains: query.search, mode: "insensitive" as const } }
      : {}),
  };

  const [data, total] = await Promise.all([
    db.lorryReceipt.findMany({
      where,
      skip: query.page * query.size,
      take: query.size,
      select: lrListSelect,
      orderBy: query.sort
        ? { [query.sort.field]: query.sort.direction }
        : { createdAt: "desc" },
    }),
    db.lorryReceipt.count({ where }),
  ]);

  return sendOk(res, data, { page: query.page, size: query.size, total });
});

/* ------------------------------------------------------------------ */
/* Detail                                                              */
/* ------------------------------------------------------------------ */
router.get("/:id", can(PERMS.LORRY_RECEIPT.VIEW), async (req, res) => {
  const id = getParamId(req);
  const lr = await db.lorryReceipt.findFirst({
    where: { id, deletedAt: null, ...lrBranchFilter(req) },
    include: lrDetailInclude,
  });
  if (!lr) throw new NotFoundError("Lorry receipt not found");
  return sendOk(res, lr);
});

/* ------------------------------------------------------------------ */
/* Update draft (per-LR: location / goods / invoice)                   */
/* ------------------------------------------------------------------ */
router.patch("/:id", can(PERMS.LORRY_RECEIPT.UPDATE), async (req, res) => {
  const id = getParamId(req);
  const existing = await db.lorryReceipt.findFirst({
    where: { id, deletedAt: null },
    include: { group: { select: { originBranchId: true } } },
  });
  if (!existing) throw new NotFoundError("Lorry receipt not found");
  if (existing.status !== "DRAFT") {
    throw new BadRequestError("Only a DRAFT lorry receipt can be edited");
  }
  assertBranchAccess(req, existing.group.originBranchId);

  const parsed = updateLRSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const input = parsed.data;
  const me = actorId(req);

  const updated = await db.$transaction(async (tx) => {
    if (input.goods) {
      await tx.lRGoods.deleteMany({ where: { lorryReceiptId: id } });
    }
    return tx.lorryReceipt.update({
      where: { id },
      data: {
        ...(input.loadingLocationId !== undefined
          ? { loadingLocationId: input.loadingLocationId ?? null }
          : {}),
        ...(input.unloadingLocationId !== undefined
          ? { unloadingLocationId: input.unloadingLocationId ?? null }
          : {}),
        ...(input.invoiceNumber !== undefined
          ? { invoiceNumber: input.invoiceNumber ?? null }
          : {}),
        ...(input.invoiceAmount !== undefined
          ? { invoiceAmount: input.invoiceAmount ?? null }
          : {}),
        ...(input.goods
          ? {
              goods: {
                create: input.goods.map((g) => ({
                  name: g.name,
                  description: g.description ?? null,
                  quantity: g.quantity,
                  unit: g.unit,
                  weight: g.weight ?? null,
                  length: g.length ?? null,
                  width: g.width ?? null,
                  height: g.height ?? null,
                })),
              },
            }
          : {}),
        updatedById: me,
        version: { increment: 1 },
      },
      include: lrDetailInclude,
    });
  });

  return sendOk(res, updated);
});

/* ------------------------------------------------------------------ */
/* Remove a DRAFT LR from its (DRAFT) group                            */
/* ------------------------------------------------------------------ */
router.delete("/:id", can(PERMS.LORRY_RECEIPT.UPDATE), async (req, res) => {
  const id = getParamId(req);
  const existing = await db.lorryReceipt.findFirst({
    where: { id, deletedAt: null },
    include: { group: { select: { id: true, status: true, originBranchId: true } } },
  });
  if (!existing) throw new NotFoundError("Lorry receipt not found");
  if (existing.status !== "DRAFT" || existing.group.status !== "DRAFT") {
    throw new BadRequestError("Only a DRAFT LR in a DRAFT group can be removed");
  }
  assertBranchAccess(req, existing.group.originBranchId);

  const remaining = await db.lorryReceipt.count({
    where: { groupId: existing.group.id, deletedAt: null },
  });
  if (remaining <= 1) {
    throw new BadRequestError("A group must keep at least one lorry receipt");
  }

  await db.lorryReceipt.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: actorId(req) },
  });

  return sendOk(res, { id });
});

/* ------------------------------------------------------------------ */
/* Add e-way bill (additional, post-finalise)                          */
/* ------------------------------------------------------------------ */
router.post(
  "/:id/eway-bills",
  can(PERMS.LORRY_RECEIPT.UPDATE),
  async (req, res) => {
    const id = getParamId(req);
    const existing = await db.lorryReceipt.findFirst({
      where: { id, deletedAt: null },
      include: {
        group: { select: { originBranchId: true } },
        ewayBill: { select: { id: true } },
      },
    });
    if (!existing) throw new NotFoundError("Lorry receipt not found");
    if (existing.status === "CANCELLED") {
      throw new BadRequestError("Cannot add e-way bill to a cancelled LR");
    }
    if (existing.ewayBill) {
      throw new BadRequestError("This LR already has an e-way bill");
    }
    assertBranchAccess(req, existing.group.originBranchId);

    const parsed = addEwayBillSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }
    const input = parsed.data;

    const ewayBill = await db.ewayBill.create({
      data: {
        lorryReceiptId: id,
        ewayBillNo: input.ewayBillNo,
        generatedAt: input.generatedAt,
        expiresAt: input.expiresAt,
        generatedBy: input.generatedBy ?? null,
        documentUrl: input.documentUrl ?? null,
      },
    });

    return sendOk(res, ewayBill, undefined, 201);
  },
);

export default router;
