import { Router } from "express";
import {
  createOrderSchema,
  updateOrderSchema,
  approveOrderSchema,
  rejectOrderSchema,
  cancelOrderSchema,
} from "@skerp/validators";
import { PERMS } from "@skerp/types";

import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { branchFilter, assertBranchAccess } from "../../auth/branch-scope.js";
import { parseListQuery } from "../_shared/list.query.js";
import { sendOk } from "../_shared/response.js";
import { getParamId } from "../_shared/param.js";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../lib/error.js";
import { publishNotificationEvent } from "../notifications/notification.service.js";
import {
  computeFreight,
  fyCodeFor,
  formatDocNumber,
  nextSequence,
  orderInclude,
  orderListSelect,
  orderQuickViewSelect,
  writeOrderEvent,
} from "./order.service.js";

const router: Router = Router();
router.use(authMiddleware);

const actorId = (req: { user?: { userId: string } }) => req.user!.userId;
const orderLink = (id: string) => `/orders/${id}`;

/* ------------------------------------------------------------------ */
/* List                                                               */
/* ------------------------------------------------------------------ */
router.get("/", can(PERMS.ORDER.VIEW), async (req, res) => {
  const query = parseListQuery(req);
  const where: Record<string, unknown> = {
    deletedAt: null,
    ...branchFilter(req, "fromBranchId"),
    ...(query.filter.status ? { status: query.filter.status } : {}),
    ...(query.search
      ? {
          OR: [
            { orderNumber: { contains: query.search, mode: "insensitive" } },
            { customer: { name: { contains: query.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    db.order.findMany({
      where,
      skip: query.page * query.size,
      take: query.size,
      select: orderListSelect,
      orderBy: query.sort
        ? { [query.sort.field]: query.sort.direction }
        : { createdAt: "desc" },
    }),
    db.order.count({ where }),
  ]);

  return sendOk(res, data, { page: query.page, size: query.size, total });
});

/* ------------------------------------------------------------------ */
/* Status counts (for list tabs)                                      */
/* ------------------------------------------------------------------ */
router.get("/status-counts", can(PERMS.ORDER.VIEW), async (req, res) => {
  const base = { deletedAt: null, ...branchFilter(req, "fromBranchId") };
  const grouped = await db.order.groupBy({
    by: ["status"],
    where: base,
    _count: { _all: true },
  });
  const counts: Record<string, number> = {};
  let all = 0;
  for (const g of grouped) {
    counts[g.status] = g._count._all;
    all += g._count._all;
  }
  counts.ALL = all;
  return sendOk(res, counts);
});

/* ------------------------------------------------------------------ */
/* Detail                                                             */
/* ------------------------------------------------------------------ */
router.get("/:id", can(PERMS.ORDER.VIEW), async (req, res) => {
  const id = getParamId(req);
  const isQuickView = req.query.view === "quick";

  if (isQuickView) {
    const order = await db.order.findFirst({
      where: { id, deletedAt: null },
      select: orderQuickViewSelect,
    });

    if (!order) throw new NotFoundError("Order not found");

    return sendOk(res, order);
  }

  const order = await db.order.findFirst({
    where: { id, deletedAt: null },
    include: orderInclude,
  });

  if (!order) throw new NotFoundError("Order not found");

  const freight = await computeFreight({
    orderType: order.orderType,
    customerId: order.customerId,
    fromBranchId: order.fromBranchId,
    toBranchId: order.toBranchId,
    vehicleTypeId: order.vehicleTypeId,
    truckQuantity: order.truckQuantity,
  });

  return sendOk(res, { ...order, freightPreview: freight });
});;


/* ------------------------------------------------------------------ */
/* Create -> PendingApproval                                          */
/* ------------------------------------------------------------------ */
router.post("/", can(PERMS.ORDER.CREATE), async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;
  assertBranchAccess(req, data.fromBranchId);

  const me = actorId(req);

  const order = await db.$transaction(async (tx) => {
    const fromBranch = await tx.branch.findUnique({
      where: { id: data.fromBranchId },
      select: { shortCode: true },
    });
    if (!fromBranch) throw new BadRequestError("From branch not found");

    const fyCode = fyCodeFor(new Date());
    const seq = await nextSequence(tx, fromBranch.shortCode, fyCode, "ORDER");
    const orderNumber = formatDocNumber(fromBranch.shortCode, fyCode, seq);

    const created = await tx.order.create({
      data: {
        orderNumber,
        customerId: data.customerId,
        fromBranchId: data.fromBranchId,
        toBranchId: data.toBranchId,
        pickupDate: data.pickupDate,
        customerLocationId: data.customerLocationId,
        pickupAddressOverride: data.pickupAddressOverride,
        specialInstructions: data.specialInstructions,
        orderType: data.orderType,
        truckQuantity: data.orderType === "Truck" ? data.truckQuantity : null,
        vehicleTypeId: data.orderType === "Truck" ? data.vehicleTypeId : null,
        contactPersonName: data.contactPersonName,
        contactMobile: data.contactMobile,
        contactEmail: data.contactEmail,
        status: "PendingApproval",
        fyCode,
        createdById: me,
        items:
          data.orderType === "Item" && data.items?.length
            ? {
                create: data.items.map((i) => ({
                  goodsId: i.goodsId,
                  quantity: i.quantity,
                  unit: i.unit,
                  weight: i.weight,
                })),
              }
            : undefined,
      },
      include: orderInclude,
    });

    await writeOrderEvent(
      tx,
      created.id,
      me,
      "submitted",
      "Order created and submitted for approval"
    );

    return created;
  });

  await publishNotificationEvent({
    eventType: "order.submitted",
    sourceModule: "order",
    aggregateType: "Order",
    aggregateId: order.id,
    branchId: order.fromBranchId,
    actorId: me,
    payload: {
      orderNumber: order.orderNumber,
      fromBranchId: order.fromBranchId,
      createdById: order.createdById,
      customerName: order.customer?.name,
      linkUrl: orderLink(order.id),
    },
  });

  return sendOk(res, order, undefined, 201);
});

/* ------------------------------------------------------------------ */
/* Edit (PendingApproval/Rejected full; Confirmed soft only)          */
/* ------------------------------------------------------------------ */
router.patch("/:id", can(PERMS.ORDER.UPDATE), async (req, res) => {
  const id = getParamId(req);
  const existing = await db.order.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new NotFoundError("Order not found");
  assertBranchAccess(req, existing.fromBranchId);

  const clientVersion =
    typeof req.body?.version === "number" ? req.body.version : undefined;
  if (clientVersion !== undefined && clientVersion !== existing.version) {
    throw new ConflictError("This order changed in another tab — reload and retry");
  }

  const frozen = ["Cancelled", "InProgress", "Completed"];
  if (frozen.includes(existing.status)) {
    throw new BadRequestError(`A ${existing.status} order cannot be edited`);
  }

  const parsed = updateOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;
  const me = actorId(req);

  const isResubmit = existing.status === "Rejected";

  const updated = await db.$transaction(async (tx) => {
    if (existing.status === "Confirmed") {
      // Soft fields only.
      const row = await tx.order.update({
        where: { id },
        data: {
          contactPersonName: data.contactPersonName,
          contactMobile: data.contactMobile,
          contactEmail: data.contactEmail,
          specialInstructions: data.specialInstructions,
          updatedById: me,
          version: { increment: 1 },
        },
        include: orderInclude,
      });
      await writeOrderEvent(tx, id, me, "edited", "Contact / instructions updated");
      return row;
    }

    // PendingApproval or Rejected → full edit. Replace item lines.
    assertBranchAccess(req, data.fromBranchId);
    await tx.orderItem.deleteMany({ where: { orderId: id } });

    const row = await tx.order.update({
      where: { id },
      data: {
        customerId: data.customerId,
        fromBranchId: data.fromBranchId,
        toBranchId: data.toBranchId,
        pickupDate: data.pickupDate,
        customerLocationId: data.customerLocationId ?? null,
        pickupAddressOverride: data.pickupAddressOverride ?? null,
        specialInstructions: data.specialInstructions ?? null,
        orderType: data.orderType,
        truckQuantity: data.orderType === "Truck" ? data.truckQuantity : null,
        vehicleTypeId: data.orderType === "Truck" ? data.vehicleTypeId : null,
        contactPersonName: data.contactPersonName ?? null,
        contactMobile: data.contactMobile ?? null,
        contactEmail: data.contactEmail ?? null,
        status: isResubmit ? "PendingApproval" : existing.status,
        rejectionReason: isResubmit ? null : existing.rejectionReason,
        updatedById: me,
        version: { increment: 1 },
        items:
          data.orderType === "Item" && data.items?.length
            ? {
                create: data.items.map((i) => ({
                  goodsId: i.goodsId,
                  quantity: i.quantity,
                  unit: i.unit,
                  weight: i.weight,
                })),
              }
            : undefined,
      },
      include: orderInclude,
    });

    await writeOrderEvent(
      tx,
      id,
      me,
      isResubmit ? "resubmitted" : "edited",
      isResubmit ? "Order edited and resubmitted for approval" : "Order updated"
    );
    return row;
  });

  if (isResubmit) {
    await publishNotificationEvent({
      eventType: "order.submitted",
      sourceModule: "order",
      aggregateType: "Order",
      aggregateId: updated.id,
      branchId: updated.fromBranchId,
      actorId: me,
      payload: {
        orderNumber: updated.orderNumber,
        fromBranchId: updated.fromBranchId,
        createdById: updated.createdById,
        customerName: updated.customer?.name,
        linkUrl: orderLink(updated.id),
      },
    });
  }

  return sendOk(res, updated);
});

/* ------------------------------------------------------------------ */
/* Approve -> Confirmed                                               */
/* ------------------------------------------------------------------ */
router.post("/:id/approve", can(PERMS.ORDER.APPROVE), async (req, res) => {
  const id = getParamId(req);
  const existing = await db.order.findFirst({
    where: { id, deletedAt: null },
    include: { customer: { select: { disallowNewLRBooking: true } } },
  });
  if (!existing) throw new NotFoundError("Order not found");
  assertBranchAccess(req, existing.fromBranchId);

  if (existing.status !== "PendingApproval") {
    throw new BadRequestError(`Only a PendingApproval order can be approved`);
  }

  const parsed = approveOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const { bookingFreightAmount, freightOverrideReason, acknowledgeDisallow } =
    parsed.data;

  if (existing.customer.disallowNewLRBooking && !acknowledgeDisallow) {
    throw new BadRequestError(
      "This customer is flagged disallow-new-booking. Confirm to proceed.",
      "DISALLOW_NOT_ACKNOWLEDGED"
    );
  }

  // Use the provided freight, else auto-compute (may be null for unmatched/Item).
  let freight = bookingFreightAmount ?? null;
  if (freight === null) {
    const computed = await computeFreight({
      orderType: existing.orderType,
      customerId: existing.customerId,
      fromBranchId: existing.fromBranchId,
      toBranchId: existing.toBranchId,
      vehicleTypeId: existing.vehicleTypeId,
      truckQuantity: existing.truckQuantity,
    });
    freight = computed.amount;
  }

  const me = actorId(req);
  const selfApprove = existing.createdById === me;

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.order.update({
      where: { id },
      data: {
        status: "Confirmed",
        approvedById: me,
        approvedAt: new Date(),
        bookingFreightAmount: freight,
        freightOverrideReason: freightOverrideReason ?? null,
        version: { increment: 1 },
      },
      include: orderInclude,
    });
    await writeOrderEvent(
      tx,
      id,
      me,
      "confirmed",
      selfApprove ? "Approved by creator (self-approval)" : "Order approved",
      freightOverrideReason ? { freightOverrideReason } : undefined
    );
    return row;
  });

  await publishNotificationEvent({
    eventType: "order.confirmed",
    sourceModule: "order",
    aggregateType: "Order",
    aggregateId: updated.id,
    branchId: updated.fromBranchId,
    actorId: me,
    payload: {
      orderNumber: updated.orderNumber,
      createdById: updated.createdById,
      linkUrl: orderLink(updated.id),
    },
  });

  return sendOk(res, updated);
});

/* ------------------------------------------------------------------ */
/* Reject -> Rejected                                                 */
/* ------------------------------------------------------------------ */
router.post("/:id/reject", can(PERMS.ORDER.REJECT), async (req, res) => {
  const id = getParamId(req);
  const existing = await db.order.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new NotFoundError("Order not found");
  assertBranchAccess(req, existing.fromBranchId);

  if (existing.status !== "PendingApproval") {
    throw new BadRequestError("Only a PendingApproval order can be rejected");
  }

  const parsed = rejectOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const me = actorId(req);

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.order.update({
      where: { id },
      data: {
        status: "Rejected",
        rejectionReason: parsed.data.reason,
        version: { increment: 1 },
      },
      include: orderInclude,
    });
    await writeOrderEvent(tx, id, me, "rejected", parsed.data.reason);
    return row;
  });

  await publishNotificationEvent({
    eventType: "order.rejected",
    sourceModule: "order",
    aggregateType: "Order",
    aggregateId: updated.id,
    branchId: updated.fromBranchId,
    actorId: me,
    payload: {
      orderNumber: updated.orderNumber,
      createdById: updated.createdById,
      reason: parsed.data.reason,
      linkUrl: orderLink(updated.id),
    },
  });

  return sendOk(res, updated);
});

/* ------------------------------------------------------------------ */
/* Cancel -> Cancelled                                                */
/* ------------------------------------------------------------------ */
router.post("/:id/cancel", can(PERMS.ORDER.CANCEL), async (req, res) => {
  const id = getParamId(req);
  const existing = await db.order.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new NotFoundError("Order not found");
  assertBranchAccess(req, existing.fromBranchId);

  if (!["PendingApproval", "Confirmed"].includes(existing.status)) {
    throw new BadRequestError(
      "Only a PendingApproval or Confirmed order can be cancelled"
    );
  }

  const parsed = cancelOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const me = actorId(req);

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.order.update({
      where: { id },
      data: {
        status: "Cancelled",
        cancelReason: parsed.data.reason,
        version: { increment: 1 },
      },
      include: orderInclude,
    });
    await writeOrderEvent(tx, id, me, "cancelled", parsed.data.reason);
    return row;
  });

  return sendOk(res, updated);
});

export default router;
