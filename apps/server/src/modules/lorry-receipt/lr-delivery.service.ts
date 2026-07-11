import { Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import { BadRequestError } from "../../lib/error.js";
import { publishNotificationEvent } from "../notifications/notification.service.js";

/**
 * Post-transit LR lifecycle helpers: delivery, acknowledgement and the
 * trip-close delivery gate. See docs/LR_DELIVERY_ACK_PLAN.md.
 */

const userRefSelect = {
  id: true,
  firstName: true,
  lastName: true,
} satisfies Prisma.UserSelect;

export const deliveryInclude = {
  createdBy: { select: userRefSelect },
  updatedBy: { select: userRefSelect },
} satisfies Prisma.LRDeliveryInclude;

export const ackInclude = {
  items: true,
  createdBy: { select: userRefSelect },
  updatedBy: { select: userRefSelect },
} satisfies Prisma.LRAcknowledgementInclude;

type GroupLegs = {
  primaryTripId: string | null;
  secondaryTripId: string | null;
};

/**
 * The trip that actually delivers the group's goods: leg 2 after a hub split,
 * otherwise the primary trip. Market-vehicle groups have neither.
 */
export const finalTripIdOf = (group: GroupLegs): string | null =>
  group.secondaryTripId ?? group.primaryTripId;

/**
 * Trip-close delivery gate ("Way 1" in the plan). Returns the LR numbers that
 * block closing `tripId`:
 *  - groups whose FINAL trip is this trip, with undelivered LRs, block it;
 *  - a leg-1 group already held at hub (hubId set, no leg 2 yet) is exempt —
 *    the goods are accounted for at the hub, awaiting dispatch.
 */
export const undeliveredLRNumbersForTrip = async (
  tripId: string,
): Promise<string[]> => {
  const groups = await db.lRGroup.findMany({
    where: {
      deletedAt: null,
      status: "FINALISED",
      OR: [
        { secondaryTripId: tripId },
        { primaryTripId: tripId, secondaryTripId: null, hubId: null },
      ],
    },
    select: {
      lorryReceipts: {
        where: { deletedAt: null, status: "FINALISED" },
        select: { lrNumber: true },
      },
    },
  });
  return groups.flatMap((g) => g.lorryReceipts.map((lr) => lr.lrNumber));
};

/**
 * Undo-delivery is blocked once the final trip is Closed — reverting the LR
 * would silently recreate the closed-trip-with-undelivered-LR inconsistency
 * the gate exists to prevent. An admin must reopen the trip first.
 */
export const publishLRDelivered = async (
  lr: {
    id: string;
    lrNumber: string;
    createdById: string;
    group: { id: string; originBranchId: string; destinationBranchId: string };
  },
  me: string,
) => {
  await publishNotificationEvent({
    eventType: "lr.delivered",
    sourceModule: "lorry-receipt",
    aggregateType: "LorryReceipt",
    aggregateId: lr.id,
    branchId: lr.group.originBranchId,
    actorId: me,
    payload: {
      lrNumber: lr.lrNumber,
      createdById: lr.createdById,
      fromBranchId: lr.group.originBranchId,
      toBranchId: lr.group.destinationBranchId,
      linkUrl: `/lorry-receipts/${lr.group.id}`,
    },
  });
};

export const assertFinalTripNotClosed = async (
  group: GroupLegs,
): Promise<void> => {
  const finalTripId = finalTripIdOf(group);
  if (!finalTripId) return; // market vehicle — nothing to gate
  const trip = await db.vehicleTrip.findUnique({
    where: { id: finalTripId },
    select: { status: true, tripNumber: true },
  });
  if (trip?.status === "Closed") {
    throw new BadRequestError(
      `Cannot undo delivery: trip ${trip.tripNumber} is already closed. Reopen the trip first.`,
    );
  }
};
