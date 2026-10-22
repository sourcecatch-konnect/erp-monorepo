import type { TrainingVerifierKey } from "@skerp/types";
import { db } from "../../../prisma/prisma.js";

/**
 * A6 — "has this user really done it?" One read-only `findFirst` per key,
 * against the records' own created-by / approved-by columns. Training never
 * hooks into other modules; it only looks at what they already store.
 *
 * Run only for steps not yet done, so each lookup happens at most once per
 * user per step.
 */

type Verifier = (userId: string) => Promise<boolean>;

const found = async (row: Promise<{ id: string } | null>): Promise<boolean> =>
  (await row) !== null;

const id = { id: true } as const;

export const VERIFIERS: Record<TrainingVerifierKey, Verifier> = {
  "order.created": (userId) =>
    found(db.order.findFirst({ where: { createdById: userId }, select: id })),
  "order.approved": (userId) =>
    found(db.order.findFirst({ where: { approvedById: userId }, select: id })),
  "lr.created": (userId) =>
    found(db.lorryReceipt.findFirst({ where: { createdById: userId }, select: id })),
  "lr.finalised": (userId) =>
    found(db.lRGroup.findFirst({ where: { finalisedById: userId }, select: id })),
  "lr.delivered": (userId) =>
    found(db.lRDelivery.findFirst({ where: { createdById: userId }, select: id })),
  "lr.acknowledged": (userId) =>
    found(db.lRAcknowledgement.findFirst({ where: { createdById: userId }, select: id })),
  "trip.created": (userId) =>
    found(db.vehicleTrip.findFirst({ where: { createdById: userId }, select: id })),
  "trip_expense.created": (userId) =>
    found(db.tripExpense.findFirst({ where: { createdById: userId }, select: id })),
  "trip_expense.approved": (userId) =>
    found(db.tripExpense.findFirst({ where: { approvedById: userId }, select: id })),
  // Closing a journey generates its Log Slip, so the generator closed it.
  "journey.closed": (userId) =>
    found(db.logSlip.findFirst({ where: { generatedById: userId }, select: id })),
  "vp_schedule.created": (userId) =>
    found(db.vPSchedule.findFirst({ where: { createdById: userId }, select: id })),
  "mrrr.created": (userId) =>
    found(db.mRRR.findFirst({ where: { createdById: userId }, select: id })),
  "vp_loading.created": (userId) =>
    found(db.vPLoading.findFirst({ where: { createdById: userId }, select: id })),
  "rake.rail_head": (userId) =>
    found(
      db.railRakeOperation.findFirst({
        where: { createdById: userId, stage: "ORIGIN_RAILHEAD" },
        select: id,
      }),
    ),
  "grn.created": (userId) =>
    found(db.gRN.findFirst({ where: { createdById: userId }, select: id })),
  "branch_grn.created": (userId) =>
    found(db.railBranchGRN.findFirst({ where: { createdById: userId }, select: id })),
  "delivery_challan.created": (userId) =>
    found(db.deliveryChallan.findFirst({ where: { createdById: userId }, select: id })),
  "bill.created": (userId) =>
    found(db.bill.findFirst({ where: { createdById: userId }, select: id })),
  "bill.approved": (userId) =>
    found(db.bill.findFirst({ where: { approvedById: userId }, select: id })),
  "bill.finalised": (userId) =>
    found(db.bill.findFirst({ where: { finalisedById: userId }, select: id })),
  "receipt.created": (userId) =>
    found(db.receipt.findFirst({ where: { createdById: userId }, select: id })),
  "payment_slip.created": (userId) =>
    found(db.vendorPaymentSlip.findFirst({ where: { createdById: userId }, select: id })),
  "payment_slip.approved": (userId) =>
    found(db.vendorPaymentSlip.findFirst({ where: { approvedById: userId }, select: id })),
  "purchase_order.created": (userId) =>
    found(db.purchaseOrder.findFirst({ where: { createdById: userId }, select: id })),
  "inward.created": (userId) =>
    found(db.spareInward.findFirst({ where: { createdById: userId }, select: id })),
  "job_card.created": (userId) =>
    found(db.jobCard.findFirst({ where: { createdById: userId }, select: id })),
  "job_card.finalised": (userId) =>
    found(db.jobCard.findFirst({ where: { finalisedById: userId }, select: id })),
  "service_bill.created": (userId) =>
    found(db.serviceBill.findFirst({ where: { createdById: userId }, select: id })),
};
