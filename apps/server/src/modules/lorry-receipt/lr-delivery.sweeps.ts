import { db } from "../../../prisma/prisma.js";
import { publishNotificationEvent } from "../notifications/notification.service.js";

/**
 * Daily reminder sweeps for the post-transit LR lifecycle
 * (docs/LR_DELIVERY_ACK_PLAN.md §9):
 *  - a group lying at the hub for more than HUB_OVERDUE_DAYS nudges the hub
 *    (head-office) branch to arrange the leg-2 truck;
 *  - an LR delivered more than POD_OVERDUE_DAYS ago without an
 *    acknowledgement reminds the origin branch's accounts team to chase the
 *    signed POD paper.
 * Events are deduped per entity (dedupeKey), so each LR/group notifies once.
 */

const HUB_OVERDUE_DAYS = 3;
const POD_OVERDUE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export const runDeliverySweeps = async (): Promise<void> => {
  const now = Date.now();

  const overdueAtHub = await db.lRGroup.findMany({
    where: {
      deletedAt: null,
      status: "FINALISED",
      hubId: { not: null },
      secondaryTripId: null,
      hubArrivalAt: { lte: new Date(now - HUB_OVERDUE_DAYS * DAY_MS) },
    },
    select: {
      id: true,
      groupNumber: true,
      hubId: true,
      hubArrivalAt: true,
      destinationBranch: { select: { name: true } },
    },
  });

  for (const group of overdueAtHub) {
    const days = group.hubArrivalAt
      ? Math.floor((now - group.hubArrivalAt.getTime()) / DAY_MS)
      : HUB_OVERDUE_DAYS;
    await publishNotificationEvent({
      eventType: "lr.at_hub.overdue",
      sourceModule: "lorry-receipt",
      aggregateType: "LRGroup",
      aggregateId: group.id,
      branchId: group.hubId,
      payload: {
        groupNumber: group.groupNumber,
        days: String(days),
        destination: group.destinationBranch?.name ?? "destination",
        linkUrl: `/lorry-receipts/${group.id}`,
      },
      dedupeKey: `lr.at_hub.overdue:${group.id}`,
    });
  }

  const overduePods = await db.lorryReceipt.findMany({
    where: {
      deletedAt: null,
      status: "DELIVERED",
      delivery: {
        deliveredAt: { lte: new Date(now - POD_OVERDUE_DAYS * DAY_MS) },
      },
    },
    select: {
      id: true,
      lrNumber: true,
      delivery: { select: { deliveredAt: true } },
      group: { select: { id: true, originBranchId: true } },
    },
  });

  for (const lr of overduePods) {
    const days = lr.delivery
      ? Math.floor((now - lr.delivery.deliveredAt.getTime()) / DAY_MS)
      : POD_OVERDUE_DAYS;
    await publishNotificationEvent({
      eventType: "lr.pod.overdue",
      sourceModule: "lorry-receipt",
      aggregateType: "LorryReceipt",
      aggregateId: lr.id,
      branchId: lr.group.originBranchId,
      payload: {
        lrNumber: lr.lrNumber,
        days: String(days),
        linkUrl: `/lorry-receipts/${lr.group.id}`,
      },
      dedupeKey: `lr.pod.overdue:${lr.id}`,
    });
  }
};

/** Run shortly after boot, then daily. */
export const startDeliverySweeps = (): void => {
  const run = () =>
    runDeliverySweeps().catch((error) =>
      console.error("[lr-delivery] Sweep failed:", error),
    );
  setTimeout(run, 60 * 1000);
  setInterval(run, DAY_MS);
};
