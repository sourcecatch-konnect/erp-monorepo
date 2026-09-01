import {
  Prisma,
  type LRGroupStatus,
  type LRStatus,
  type TripStatus,
} from "../../../generated/prisma/index.js";

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
  plannedStartDateTime: true,
  createdAs: true,
  endDateTime: true,
  arrivalDateTime: true,
  unloadingCompletedAt: true,
  closeReason: true,
  version: true,
  createdAt: true,
  journeyId: true,
  sequenceNo: true,
  legType: true,
  isReturnLeg: true,
  // Live LR groups touching this trip, with their live LR statuses. The list
  // route folds these into `undeliveredLrCount` (the "Way 1" Close gate) and
  // `lrSummary` (the cargo line under the status badge) — see
  // `summariseTripCargo`.
  primaryGroups: {
    where: { deletedAt: null, status: { not: "CANCELLED" } },
    select: {
      status: true,
      hubId: true,
      secondaryTripId: true,
      lorryReceipts: {
        where: { deletedAt: null, status: { not: "CANCELLED" } },
        select: { status: true },
      },
    },
  },
  secondaryGroups: {
    where: { deletedAt: null, status: { not: "CANCELLED" } },
    select: {
      status: true,
      lorryReceipts: {
        where: { deletedAt: null, status: { not: "CANCELLED" } },
        select: { status: true },
      },
    },
  },
} satisfies Prisma.VehicleTripSelect;

type CargoLR = { status: LRStatus };
type CargoGroup = { status: LRGroupStatus; lorryReceipts: CargoLR[] };
type CargoPrimaryGroup = CargoGroup & {
  hubId: string | null;
  secondaryTripId: string | null;
};

/** LR states that still block closing the trip they ride on. */
const OPEN_LR_STATUSES: ReadonlySet<LRStatus> = new Set(["DRAFT", "FINALISED"]);

/**
 * Folds a list row's group relations into the two cargo fields the web reads:
 *
 * - `undeliveredLrCount` — the trip-close gate. Counts DRAFT + FINALISED LRs
 *   on groups whose FINAL leg is this trip. Must mirror
 *   `undeliveredLRNumbersForTrip` (lr-delivery.service.ts): a leg-1 group
 *   already held at hub — or already moved on to a leg-2 trip — is exempt.
 * - `lrSummary` — status buckets for the cargo line under the trip's status
 *   badge. A leg-1 group that moved on to leg 2 is skipped entirely: its LRs
 *   are the secondary trip's story, not this row's.
 */
export const summariseTripCargo = (
  primaryGroups: CargoPrimaryGroup[],
  secondaryGroups: CargoGroup[],
) => {
  const summary = {
    total: 0,
    draft: 0,
    undelivered: 0,
    atHub: 0,
    delivered: 0,
  };
  let gate = 0;

  const tally = (
    group: CargoGroup,
    opts: { blocking: boolean; atHub: boolean },
  ) => {
    for (const lr of group.lorryReceipts) {
      summary.total += 1;
      if (lr.status === "DRAFT") summary.draft += 1;
      else if (lr.status === "FINALISED") {
        if (opts.atHub) summary.atHub += 1;
        else summary.undelivered += 1;
      } else summary.delivered += 1; // DELIVERED | ACKNOWLEDGED
      if (opts.blocking && OPEN_LR_STATUSES.has(lr.status)) gate += 1;
    }
  };

  for (const g of primaryGroups) {
    if (g.secondaryTripId !== null) continue; // handed over to leg 2
    const groupOpen = g.status === "DRAFT" || g.status === "FINALISED";
    tally(g, {
      blocking: groupOpen && g.hubId === null,
      atHub: g.hubId !== null,
    });
  }
  for (const g of secondaryGroups) {
    const groupOpen = g.status === "DRAFT" || g.status === "FINALISED";
    tally(g, { blocking: groupOpen, atHub: false });
  }

  return { undeliveredLrCount: gate, lrSummary: summary };
};

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

/**
 * Live LR group shape for the trip detail's cargo card — everything the web
 * needs to tell the goods' story (branch flow, hub hold, market vehicle, LR
 * rows with delivery info). Cancelled groups/LRs are excluded, matching the
 * list's cargo summary.
 */
const tripGroupSelect = {
  where: { deletedAt: null, status: { not: "CANCELLED" } },
  select: {
    id: true,
    groupNumber: true,
    status: true,
    transportType: true,
    priority: true,
    sealNumber: true,
    isMarketVehicle: true,
    marketVehicleNumber: true,
    marketDriverName: true,
    tripLegType: true,
    hubId: true,
    hubArrivalAt: true,
    primaryTripId: true,
    secondaryTripId: true,
    consignor: { select: { id: true, name: true } },
    consignee: { select: { id: true, name: true } },
    originBranch: { select: { id: true, name: true } },
    destinationBranch: { select: { id: true, name: true } },
    hub: { select: { id: true, name: true } },
    lorryReceipts: {
      where: { deletedAt: null, status: { not: "CANCELLED" } },
      orderBy: { lrNumber: "asc" as const },
      select: {
        id: true,
        lrNumber: true,
        status: true,
        totalWeight: true,
        unit: true,
        invoiceNumber: true,
        delivery: {
          select: {
            deliveredAt: true,
            receiverName: true,
            receiverPhone: true,
          },
        },
      },
    },
  },
} as const;

/** Fully-hydrated trip for the detail page. */
export const tripInclude = {
  journey: { select: { id: true, journeyNumber: true, status: true } },
  vehicle: {
    select: {
      id: true,
      vehicleNumber: true,
      ownershipType: true,
      capacityMT: true,
      bodyType: true,
    },
  },
  driver: {
    select: {
      id: true,
      name: true,
      mobile: true,
      licenseNo: true,
      licenseExpiryDate: true,
    },
  },
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
  primaryGroups: tripGroupSelect,
  secondaryGroups: tripGroupSelect,
  TripUnloadingPoint: {
    orderBy: { sequence: "asc" as const },
    select: {
      id: true,
      sequence: true,
      plannedDate: true,
      actualDate: true,
      actualArrivalAt: true,
      actualUnloadingAt: true,
      actualDepartureAt: true,
      receivedQty: true,
      damageQty: true,
      shortageQty: true,
      remarks: true,
      city: { select: { id: true, name: true } },
      location: { select: { id: true, name: true } },
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
