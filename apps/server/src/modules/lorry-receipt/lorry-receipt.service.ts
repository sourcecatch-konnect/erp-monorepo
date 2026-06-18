import { Prisma } from "../../../generated/prisma/index.js";
import { BadRequestError } from "../../lib/error.js";

type Tx = Prisma.TransactionClient;

/* ------------------------------------------------------------------ */
/* LR number generation                                                */
/* ------------------------------------------------------------------ */

/**
 * LR numbers are branch-scoped: SKT/<branchCode>/<fyCode>/<00001>
 * Reuses the DocumentSequence table with docType "LR".
 */
export const generateLRNumber = async (
  tx: Tx,
  branchCode: string,
  fyCode: string,
): Promise<string> => {
  const rows = await tx.$queryRaw<{ seq: number }[]>`
    INSERT INTO "DocumentSequence" ("id", "branchCode", "fyCode", "docType", "nextSeq", "updatedAt")
    VALUES (gen_random_uuid()::text, ${branchCode}, ${fyCode}, ${"LR"}, 2, now())
    ON CONFLICT ("branchCode", "fyCode", "docType")
    DO UPDATE SET "nextSeq" = "DocumentSequence"."nextSeq" + 1, "updatedAt" = now()
    RETURNING ("nextSeq" - 1) AS seq
  `;
  const seq = Number(rows[0]?.seq ?? 1);
  return `SKT/${branchCode}/${fyCode}/${String(seq).padStart(5, "0")}`;
};

/* ------------------------------------------------------------------ */
/* Truck slot guard                                                    */
/* ------------------------------------------------------------------ */

/**
 * Count non-cancelled LRs for an Order (draft + finalised both occupy a slot).
 * Pass `excludeId` to ignore the current LR itself on an update path.
 */
export const countUsedTruckSlots = async (
  tx: Tx,
  orderId: string,
  excludeId?: string,
): Promise<number> => {
  return tx.lorryReceipt.count({
    where: {
      orderId,
      status: { not: "CANCELLED" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
};

export const assertTruckSlotAvailable = async (
  tx: Tx,
  orderId: string,
  truckQuantity: number,
  excludeId?: string,
): Promise<void> => {
  const used = await countUsedTruckSlots(tx, orderId, excludeId);
  if (used >= truckQuantity) {
    throw new BadRequestError(
      `All ${truckQuantity} truck slot(s) for this order are already allocated`,
    );
  }
};

/* ------------------------------------------------------------------ */
/* Hub (head-office branch) resolver                                    */
/* ------------------------------------------------------------------ */

/**
 * The hub is always the head-office branch (Jalgaon) — never picked. Resolve it
 * from the singleton `isHeadOffice` flag. Throws if none is configured.
 */
export const resolveHubBranchId = async (tx: Tx): Promise<string> => {
  const ho = await tx.branch.findFirst({
    where: { isHeadOffice: true },
    select: { id: true },
  });
  if (!ho) {
    throw new BadRequestError(
      "No head-office branch is configured. Mark a branch as Head Office to enable hub split.",
    );
  }
  return ho.id;
};

/* ------------------------------------------------------------------ */
/* Prisma select shapes                                                */
/* ------------------------------------------------------------------ */

const tripSelect = {
  id: true,
  tripNumber: true,
  tripName: true,
  status: true,
  vehicle: { select: { id: true, vehicleNumber: true } },
  driver: { select: { id: true, name: true } },
  route: {
    select: {
      id: true,
      sourceCity: { select: { id: true, name: true } },
      destinationCity: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.VehicleTripSelect;

export const lrListSelect = {
  id: true,
  lrNumber: true,
  status: true,
  source: true,
  transportType: true,
  tripLegType: true,
  priority: true,
  isMarketVehicle: true,
  marketVehicleNumber: true,
  marketDriverName: true,
  fyCode: true,
  createdAt: true,
  primaryTrip: { select: tripSelect },
  secondaryTrip: { select: tripSelect },
  hub: { select: { id: true, name: true, branchCode: true } },
  railheadBranch: { select: { id: true, name: true, branchCode: true } },
  consignor: { select: { id: true, name: true, shortName: true } },
  consignee: { select: { id: true, name: true, shortName: true } },
  originBranch: { select: { id: true, name: true, branchCode: true } },
  destinationBranch: { select: { id: true, name: true, branchCode: true } },
  order: { select: { id: true, orderNumber: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.LorryReceiptSelect;

export const lrDetailInclude = {
  primaryTrip: { select: tripSelect },
  secondaryTrip: { select: tripSelect },
  hub: { select: { id: true, name: true, branchCode: true } },
  railheadBranch: { select: { id: true, name: true, branchCode: true } },
  consignor: { select: { id: true, name: true, shortName: true } },
  consignee: { select: { id: true, name: true, shortName: true } },
  originBranch: { select: { id: true, name: true, branchCode: true } },
  destinationBranch: { select: { id: true, name: true, branchCode: true } },
  order: { select: { id: true, orderNumber: true, truckQuantity: true } },
  goods: true,
  charges: true,
  ewayBills: { orderBy: { generatedAt: "asc" as const } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  updatedBy: { select: { id: true, firstName: true, lastName: true } },
  finalisedBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.LorryReceiptInclude;
