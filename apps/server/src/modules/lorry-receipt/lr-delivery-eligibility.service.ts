import type { LRDeliveryEligibility } from "@skerp/types";
import { Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import { BadRequestError } from "../../lib/error.js";

type DbClient = Prisma.TransactionClient | typeof db;

const blocked = (
  stage: LRDeliveryEligibility["stage"],
  reasons: string[],
  quantities?: { requiredQuantity: number; issuedQuantity: number },
  railwayDetails?: LRDeliveryEligibility["railwayDetails"],
): LRDeliveryEligibility => ({
  eligible: false,
  stage,
  reasons,
  ...quantities,
  ...(railwayDetails ? { railwayDetails } : {}),
});

const ready = (
  quantities?: { requiredQuantity: number; issuedQuantity: number },
  railwayDetails?: LRDeliveryEligibility["railwayDetails"],
): LRDeliveryEligibility => ({
  eligible: true,
  stage: "READY_FOR_DELIVERY",
  reasons: [],
  ...quantities,
  ...(railwayDetails ? { railwayDetails } : {}),
});

/**
 * Authoritative delivery gate for Road and Road + Rail LRs.
 *
 * Rail quantities follow the same rule as Delivery Challan allocation:
 * dispatchable quantity = Branch GRN received quantity - damaged quantity.
 * Only ISSUED challans count as dispatched from the destination branch.
 */
export const getLRDeliveryEligibilities = async (
  lrIds: string[],
  client: DbClient = db,
): Promise<Map<string, LRDeliveryEligibility>> => {
  const uniqueIds = [...new Set(lrIds)];
  if (uniqueIds.length === 0) return new Map();

  const lrs = await client.lorryReceipt.findMany({
    where: { id: { in: uniqueIds }, deletedAt: null },
    select: {
      id: true,
      status: true,
      goods: { select: { id: true } },
      group: {
        select: {
          transportType: true,
          isMarketVehicle: true,
          marketVehicleId: true,
          marketVehicleNumber: true,
          hubId: true,
          primaryTrip: { select: { status: true, tripNumber: true } },
          secondaryTrip: { select: { status: true, tripNumber: true } },
        },
      },
    },
  });

  const railIds = lrs
    .filter((lr) => lr.group.transportType !== "Road")
    .map((lr) => lr.id);

  const railAllocations = railIds.length
    ? await client.vPLoadingGoods.findMany({
      where: {
        grnGoods: {
          lrGoods: { lorryReceiptId: { in: railIds } },
        },
      },
      select: {
        grnGoods: {
          select: {
            lrGoods: { select: { id: true, lorryReceiptId: true } },
          },
        },
        branchGrnItem: {
          select: {
            id: true,
            receivedQty: true,
            damageQty: true,
            shortageQty: true,
            railBranchGrn: {
              select: {
                id: true,
                status: true,
                railRake: { select: { rakeNumber: true } },
                vpWagonLoading: {
                  select: {
                    mrRrRow: { select: { vpNo: true, rowLabel: true } },
                  },
                },
              },
            },
            deliveryChallanItems: {
              select: {
                quantity: true,
                deliveryChallan: {
                  select: { id: true, challanNumber: true, status: true },
                },
              },
            },
          },
        },
      },
    })
    : [];

  const railByLr = new Map<string, typeof railAllocations>();
  for (const allocation of railAllocations) {
    const lrId = allocation.grnGoods.lrGoods?.lorryReceiptId;
    if (!lrId) continue;
    const rows = railByLr.get(lrId) ?? [];
    rows.push(allocation);
    railByLr.set(lrId, rows);
  }

  const result = new Map<string, LRDeliveryEligibility>();

  for (const lr of lrs) {
    if (lr.status === "DELIVERED" || lr.status === "ACKNOWLEDGED") {
      result.set(
        lr.id,
        blocked("ALREADY_DELIVERED", ["Lorry receipt is already delivered"]),
      );
      continue;
    }

    if (lr.status !== "FINALISED") {
      result.set(
        lr.id,
        blocked("LR_NOT_FINALISED", [
          `Lorry receipt status is ${lr.status}; FINALISED is required`,
        ]),
      );
      continue;
    }

    if (lr.group.transportType === "Road") {
      if (lr.group.hubId && !lr.group.secondaryTrip) {
        result.set(
          lr.id,
          blocked("AWAITING_ROAD_DISPATCH", [
            "Goods are at the hub and the final road trip has not been assigned",
          ]),
        );
        continue;
      }

      if (lr.group.isMarketVehicle) {
        if (!lr.group.marketVehicleId && !lr.group.marketVehicleNumber) {
          result.set(
            lr.id,
            blocked("AWAITING_ROAD_DISPATCH", [
              "Market vehicle has not been assigned",
            ]),
          );
        } else {
          result.set(lr.id, ready());
        }
        continue;
      }

      const finalTrip = lr.group.secondaryTrip ?? lr.group.primaryTrip;
      if (!finalTrip) {
        result.set(
          lr.id,
          blocked("AWAITING_ROAD_DISPATCH", [
            "Final road trip has not been assigned",
          ]),
        );
        continue;
      }
      if (finalTrip.status !== "InTransit" && finalTrip.status !== "Closed") {
        result.set(
          lr.id,
          blocked("AWAITING_ROAD_DISPATCH", [
            `Final road trip ${finalTrip.tripNumber} is ${finalTrip.status}`,
          ]),
        );
        continue;
      }

      result.set(lr.id, ready());
      continue;
    }

    const allocations = railByLr.get(lr.id) ?? [];
    const allocatedGoodsIds = new Set(
      allocations
        .map((allocation) => allocation.grnGoods.lrGoods?.id)
        .filter((id): id is string => Boolean(id)),
    );
    const missingRailGoods = lr.goods.some(
      (goods) => !allocatedGoodsIds.has(goods.id),
    );

    if (
      allocations.length === 0 ||
      missingRailGoods ||
      allocations.some((allocation) => !allocation.branchGrnItem)
    ) {
      result.set(
        lr.id,
        blocked("AWAITING_BRANCH_GRN", [
          "Destination Branch GRN has not been created for all rail goods",
        ]),
      );
      continue;
    }

    const branchItems = allocations.map(
      (allocation) => allocation.branchGrnItem!,
    );
    if (branchItems.some((item) => item.railBranchGrn.status !== "SUBMITTED")) {
      result.set(
        lr.id,
        blocked("AWAITING_BRANCH_GRN", [
          "Destination Branch GRN has not been submitted",
        ]),
      );
      continue;
    }

    const issuedChallanIds = new Set<string>();
    const issuedChallanNumbers = new Set<string>();
    let requiredQuantity = 0;
    let issuedQuantity = 0;
    let everyItemCovered = true;

    for (const item of branchItems) {
      const itemRequired = Math.max(item.receivedQty - item.damageQty, 0);
      const itemIssued = item.deliveryChallanItems.reduce((total, challanItem) => {
        if (challanItem.deliveryChallan.status !== "ISSUED") return total;
        issuedChallanIds.add(challanItem.deliveryChallan.id);
        issuedChallanNumbers.add(challanItem.deliveryChallan.challanNumber);
        return total + challanItem.quantity;
      }, 0);
      requiredQuantity += itemRequired;
      issuedQuantity += itemIssued;
      if (itemIssued < itemRequired) everyItemCovered = false;
    }

    const quantities = { requiredQuantity, issuedQuantity };
    const railwayDetails = {
      rakeNumbers: [
        ...new Set(
          branchItems.map((item) => item.railBranchGrn.railRake.rakeNumber),
        ),
      ],
      vpNumbers: [
        ...new Set(
          branchItems.map(
            (item) =>
              item.railBranchGrn.vpWagonLoading.mrRrRow.vpNo ??
              item.railBranchGrn.vpWagonLoading.mrRrRow.rowLabel,
          ),
        ),
      ],
      branchGrnIds: [
        ...new Set(branchItems.map((item) => item.railBranchGrn.id)),
      ],
      receivedQuantity: branchItems.reduce(
        (total, item) => total + item.receivedQty,
        0,
      ),
      damageQuantity: branchItems.reduce(
        (total, item) => total + item.damageQty,
        0,
      ),
      shortageQuantity: branchItems.reduce(
        (total, item) => total + item.shortageQty,
        0,
      ),
      dcNumbers: [...issuedChallanNumbers],
      issuedQuantity,
      balanceQuantity: Math.max(requiredQuantity - issuedQuantity, 0),
    };
    if (issuedChallanIds.size === 0) {
      result.set(
        lr.id,
        blocked(
          "AWAITING_DELIVERY_CHALLAN",
          ["Delivery Challan has not been issued"],
          quantities,
          railwayDetails,
        ),
      );
      continue;
    }

    if (!everyItemCovered) {
      result.set(
        lr.id,
        blocked(
          "PARTIALLY_CHALLANED",
          [
            `Issued Delivery Challans cover ${issuedQuantity} of ${requiredQuantity} dispatchable quantity`,
          ],
          quantities,
          railwayDetails,
        ),
      );
      continue;
    }

    result.set(lr.id, ready(quantities, railwayDetails));
  }

  return result;
};

export const getLRDeliveryEligibility = async (
  lrId: string,
  client: DbClient = db,
): Promise<LRDeliveryEligibility> => {
  const result = await getLRDeliveryEligibilities([lrId], client);
  return (
    result.get(lrId) ??
    blocked("LR_NOT_FINALISED", ["Lorry receipt was not found"])
  );
};

export const assertLRDeliveryEligible = (
  eligibility: LRDeliveryEligibility,
): void => {
  if (eligibility.eligible) return;
  throw new BadRequestError(
    eligibility.reasons.join("; ") || "Lorry receipt is not ready for delivery",
    "LR_DELIVERY_NOT_ELIGIBLE",
    eligibility,
  );
};
