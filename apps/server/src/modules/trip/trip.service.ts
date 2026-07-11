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
/**
 * Scalars + row-action data every trips-list row needs regardless of which
 * columns are visible (dialogs read openingKm / isReturnLeg off the row, the
 * Close gate reads the group counts).
 */
export const tripListBaseSelect = {
  id: true,
  vehicleId: true,
  tripNumber: true,
  tripName: true,
  status: true,
  tripType: true,
  driverId: true,
  onwardFreight: true,
  isTripEmpty: true,
  rakeDate: true,
  openingKm: true,
  closingKm: true,
  startDateTime: true,
  createdAt: true,
  journeyId: true,
  sequenceNo: true,
  legType: true,
  isReturnLeg: true,
  // Trip-close delivery gate ("Way 1"): groups whose FINAL leg is this trip,
  // still FINALISED, counting their live FINALISED (undelivered) LRs. Must
  // mirror `undeliveredLRNumbersForTrip` — a leg-1 group held at hub is exempt.
  primaryGroups: {
    where: {
      deletedAt: null,
      status: "FINALISED",
      secondaryTripId: null,
      hubId: null,
    },
    select: {
      _count: {
        select: {
          lorryReceipts: { where: { deletedAt: null, status: "FINALISED" } },
        },
      },
    },
  },
  secondaryGroups: {
    where: { deletedAt: null, status: "FINALISED" },
    select: {
      _count: {
        select: {
          lorryReceipts: { where: { deletedAt: null, status: "FINALISED" } },
        },
      },
    },
  },
} satisfies Prisma.VehicleTripSelect;

/**
 * Relation blocks the list joins only when the matching table column is
 * visible (`?fields=journey,vehicle,...`). Keys are the web table column ids;
 * omitting the param selects everything (backward compatible).
 */
export const tripListRelationSelects = {
  journey: {
    journey: { select: { id: true, journeyNumber: true, status: true } },
  },
  vehicle: {
    vehicle: { select: { id: true, vehicleNumber: true, ownershipType: true } },
    driver: { select: { id: true, name: true } },
  },
  route: {
    route: {
      select: {
        id: true,
        sourceCity: { select: { id: true, name: true } },
        destinationCity: { select: { id: true, name: true } },
      },
    },
  },
  client: {
    consignor: { select: { id: true, name: true, shortName: true } },
  },
} satisfies Record<string, Prisma.VehicleTripSelect>;

/** Fully-hydrated trip for the detail page. */
export const tripInclude = {
  journey: { select: { id: true, journeyNumber: true, status: true } },
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
