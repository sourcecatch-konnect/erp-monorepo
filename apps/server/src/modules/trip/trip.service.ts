import { Prisma, type TripStatus } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/** Columns for the trips list table. */
export const tripListSelect = {
  id: true,
  tripNumber: true,
  status: true,
  tripType: true,
  onwardFreight: true,
  isTripEmpty: true,
  rakeDate: true,
  startDateTime: true,
  createdAt: true,

  vehicle: {
    select: { id: true, vehicleNumber: true, ownershipType: true },
  },
  driver: {
    select: { id: true, name: true },
  },
  route: {
    select: {
      id: true,
      sourceCity: { select: { id: true, name: true } },
      destinationCity: { select: { id: true, name: true } },
    },
  },
  createdBy: {
    select: { id: true, firstName: true, lastName: true },
  },
} satisfies Prisma.VehicleTripSelect;

/** Fully-hydrated trip for the detail page. */
export const tripInclude = {
  vehicle: { select: { id: true, vehicleNumber: true, ownershipType: true } },
  driver: { select: { id: true, name: true } },
  route: {
    select: {
      id: true,
      sourceCity: { select: { id: true, name: true } },
      destinationCity: { select: { id: true, name: true } },
    },
  },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  TripStatusHistory: {
    orderBy: { changedAt: "asc" as const },
    include: {
      changedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.VehicleTripInclude;

/** Append a status-change row to a trip's history timeline. */
export const writeTripStatus = async (
  tx: Tx,
  vehicleTripId: string,
  userId: string,
  status: TripStatus,
  note?: string | null
) => {
  await tx.tripStatusHistory.create({
    data: { vehicleTripId, userId, status, note: note ?? null },
  });
};
