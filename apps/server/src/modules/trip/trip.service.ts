import { Prisma, type TripStatus } from "../../../generated/prisma/index.js";

type Tx = Prisma.TransactionClient;

/* ------------------------------------------------------------------ */
/* Trip name generation                                               */
/* ------------------------------------------------------------------ */

const pad2 = (n: number) => String(n).padStart(2, "0");

/** DDMMYYHHmm — the timestamp suffix on a trip name. */
const stamp = (d: Date) =>
  `${pad2(d.getDate())}${pad2(d.getMonth() + 1)}${pad2(d.getFullYear() % 100)}${pad2(d.getHours())}${pad2(d.getMinutes())}`;

/** DDMMYY — compact date used inside Rake(...) for DC trips. */
const dateStamp = (d: Date) =>
  `${pad2(d.getDate())}${pad2(d.getMonth() + 1)}${pad2(d.getFullYear() % 100)}`;

/**
 * Auto-generated human-readable trip label.
 *   LR : <FromCity>-<ToCity>/<TruckNumber>/<CustomerShortCode>/<DDMMYYHHmm>
 *   DC : <FromCity>-<ToCity>/<TruckNumber>/Rake(<DDMMYY>)/<DDMMYYHHmm>
 */
export const buildTripName = (args: {
  fromCity: string;
  toCity: string;
  truckNumber: string;
  tripType: "lr" | "dc";
  customerShortCode?: string | null;
  consignorName?: string | null;
  rakeDate?: Date | null;
  at: Date;
}): string => {
  const middle =
    args.tripType === "dc"
      ? `RAKE(${args.rakeDate ? dateStamp(args.rakeDate) : "?"})`
      : (args.customerShortCode || args.consignorName || "NA").toUpperCase();

  const route = `${args.fromCity}-${args.toCity}`.toUpperCase();
  const truck = args.truckNumber.toUpperCase();
  return `${route}/${truck}/${middle}/${stamp(args.at)}`;
};
/** Columns for the trips list table. */
export const tripListSelect = {
  id: true,
  tripNumber: true,
  tripName: true,
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
  consignor: {
    select: { id: true, name: true, shortName: true },
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
  consignor: { select: { id: true, name: true, shortName: true } },
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
  note?: string | null,
) => {
  await tx.tripStatusHistory.create({
    data: { vehicleTripId, userId, status, note: note ?? null },
  });
};
