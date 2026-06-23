import { Prisma } from "../../../generated/prisma/index.js";
import { BadRequestError } from "../../lib/error.js";

type Tx = Prisma.TransactionClient;

/* ------------------------------------------------------------------ */
/* Group number generation                                             */
/* ------------------------------------------------------------------ */

/**
 * Group numbers are branch-scoped: SKG/<branchCode>/<fyCode>/<00001>.
 * Reuses the DocumentSequence table with docType "LRG". The group is the
 * truckload people finalise and bill, so it gets its own stable identifier.
 */
export const generateGroupNumber = async (
  tx: Tx,
  branchCode: string,
  fyCode: string,
): Promise<string> => {
  const rows = await tx.$queryRaw<{ seq: number }[]>`
    INSERT INTO "DocumentSequence" ("id", "branchCode", "fyCode", "docType", "nextSeq", "updatedAt")
    VALUES (gen_random_uuid()::text, ${branchCode}, ${fyCode}, ${"LRG"}, 2, now())
    ON CONFLICT ("branchCode", "fyCode", "docType")
    DO UPDATE SET "nextSeq" = "DocumentSequence"."nextSeq" + 1, "updatedAt" = now()
    RETURNING ("nextSeq" - 1) AS seq
  `;
  const seq = Number(rows[0]?.seq ?? 1);
  return `SKG/${branchCode}/${fyCode}/${String(seq).padStart(5, "0")}`;
};

/* ------------------------------------------------------------------ */
/* Truck slot guard — counts GROUPS (trucks), not LRs                  */
/* ------------------------------------------------------------------ */

/**
 * A group = one truck of an order. Each non-cancelled group occupies one of the
 * order's `truckQuantity` slots. `truckIndex` must also be unique within the
 * order. Pass `excludeId` to ignore the current group on an update path.
 */
export const assertGroupSlotAvailable = async (
  tx: Tx,
  orderId: string,
  truckQuantity: number,
  truckIndex: number,
  excludeId?: string,
): Promise<void> => {
  const groups = await tx.lRGroup.findMany({
    where: {
      orderId,
      status: { not: "CANCELLED" },
      deletedAt: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, truckIndex: true },
  });

  if (groups.some((g) => g.truckIndex === truckIndex)) {
    throw new BadRequestError(`Truck #${truckIndex} of this order already has a group`);
  }
  if (groups.length >= truckQuantity) {
    throw new BadRequestError(
      `All ${truckQuantity} truck slot(s) for this order are already allocated`,
    );
  }
};

/* ------------------------------------------------------------------ */
/* Dispatch — fires ONCE per group when it attaches to a trip          */
/* ------------------------------------------------------------------ */

/**
 * Attaching a group dispatches its trip: a Planned trip flips to InTransit, the
 * start time is stamped and its vehicle is marked On Trip. One trip carries one
 * group (full load), so this runs once per group. No-op if the trip isn't
 * Planned.
 */
export const dispatchTripOnAttach = async (
  tx: Tx,
  vehicleTripId: string,
  groupNumber: string,
  userId: string,
): Promise<void> => {
  const trip = await tx.vehicleTrip.findUnique({
    where: { id: vehicleTripId },
    select: { id: true, status: true, vehicleId: true },
  });
  if (!trip || trip.status !== "Planned") return;

  await tx.vehicleTrip.update({
    where: { id: trip.id },
    data: {
      status: "InTransit",
      startDateTime: new Date(),
      updatedById: userId,
      version: { increment: 1 },
    },
  });
  await tx.vehicle.update({
    where: { id: trip.vehicleId },
    data: { status: "ON_TRIP" },
  });
  await tx.tripStatusHistory.create({
    data: {
      vehicleTripId: trip.id,
      userId,
      status: "InTransit",
      note: `Group ${groupNumber} attached`,
    },
  });
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

const locationSelect = {
  id: true,
  name: true,
  address: true,
  city: { select: { id: true, name: true } },
} satisfies Prisma.CustomerLocationSelect;

export const groupListSelect = {
  id: true,
  groupNumber: true,
  status: true,
  source: true,
  transportType: true,
  tripLegType: true,
  priority: true,
  truckIndex: true,
  fyCode: true,
  createdAt: true,
  isMarketVehicle: true,
  marketVehicleNumber: true,
  marketDriverName: true,
  baseFreightAmount: true,
  sealNumber: true,
  primaryTrip: { select: tripSelect },
  secondaryTrip: { select: tripSelect },
  hub: { select: { id: true, name: true, branchCode: true } },
  railheadBranch: { select: { id: true, name: true, branchCode: true } },
  consignor: { select: { id: true, name: true, shortName: true } },
  consignee: { select: { id: true, name: true, shortName: true } },
  originBranch: { select: { id: true, name: true, branchCode: true } },
  destinationBranch: { select: { id: true, name: true, branchCode: true } },
  order: { select: { id: true, orderNumber: true } },
  _count: { select: { lorryReceipts: true } },
} satisfies Prisma.LRGroupSelect;

export const groupDetailInclude = {
  primaryTrip: { select: tripSelect },
  secondaryTrip: { select: tripSelect },
  hub: { select: { id: true, name: true, branchCode: true } },
  railheadBranch: { select: { id: true, name: true, branchCode: true } },
  consignor: { select: { id: true, name: true, shortName: true } },
  consignee: { select: { id: true, name: true, shortName: true } },
  originBranch: { select: { id: true, name: true, branchCode: true } },
  destinationBranch: { select: { id: true, name: true, branchCode: true } },
  order: {
    select: { id: true, orderNumber: true, truckQuantity: true, bookingFreightAmount: true },
  },
  lorryReceipts: {
    where: { deletedAt: null },
    include: {
      loadingLocation: { select: locationSelect },
      unloadingLocation: { select: locationSelect },
      goods: true,
      ewayBills: { orderBy: { generatedAt: "asc" as const } },
    },
  },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  updatedBy: { select: { id: true, firstName: true, lastName: true } },
  finalisedBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.LRGroupInclude;
