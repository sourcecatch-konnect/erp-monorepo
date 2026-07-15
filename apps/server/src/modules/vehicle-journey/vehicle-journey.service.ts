import { Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import { BadRequestError } from "../../lib/error.js";
import { writeTripStatus } from "../trip/trip.service.js";

type Tx = Prisma.TransactionClient;

export const TX_BUDGET = { timeout: 15000, maxWait: 10000 } as const;

/**
 * The configured journey base. The base city comes from the head-office
 * branch flag, not a hardcoded city id.
 */
export const getHeadOffice = async (): Promise<{
  branchId: string;
  cityId: string;
  cityName: string;
}> => {
  const ho = await db.branch.findFirst({
    where: { isHeadOffice: true },
    select: { id: true, cityId: true, city: { select: { name: true } } },
  });
  if (!ho) {
    throw new BadRequestError(
      "No head-office branch is configured - set isHeadOffice on the base branch",
    );
  }
  if (!ho.cityId || !ho.city) {
    throw new BadRequestError("The head-office branch has no city configured");
  }
  return { branchId: ho.id, cityId: ho.cityId, cityName: ho.city.name };
};

/* ------------------------------------------------------------------ */
/* Selects / includes                                                 */
/* ------------------------------------------------------------------ */

const cityRef = { select: { id: true, name: true } } as const;

/** Leg columns shared by the journey list chain and the detail legs table. */
export const journeyLegSelect = {
  id: true,
  tripNumber: true,
  tripName: true,
  status: true,
  tripType: true,
  legType: true,
  journeyId: true,
  sequenceNo: true,
  fromCityId: true,
  toCityId: true,
  isReturnLeg: true,
  isTripEmpty: true,
  onwardFreight: true,
  openingKm: true,
  closingKm: true,
  startDateTime: true,
  endDateTime: true,
  arrivalDateTime: true,
  unloadingCompletedAt: true,
  closeReason: true,
  chainExceptionReason: true,
  rakeDate: true,
  cancelReason: true,
  consignorId: true,
  fromCity: cityRef,
  toCity: cityRef,
  consignor: { select: { id: true, name: true, shortName: true } },
  route: {
    select: {
      id: true,
      sourceCity: cityRef,
      destinationCity: cityRef,
    },
  },
} satisfies Prisma.VehicleTripSelect;

/** Columns for the journey cockpit list. */
export const journeyListSelect = {
  id: true,
  journeyNumber: true,
  fyCode: true,
  status: true,
  settlementStatus: true,
  openingKm: true,
  closingKm: true,
  startedAt: true,
  closedAt: true,
  createdAt: true,
  vehicleId: true,
  driverId: true,
  vehicle: { select: { id: true, vehicleNumber: true } },
  driver: { select: { id: true, name: true } },
  homeBranch: { select: { id: true, name: true, branchCode: true } },
  startCity: cityRef,
  returnCity: cityRef,
  currentCity: cityRef,
  logSlip: { select: { id: true, logSlipNumber: true, status: true } },
  trips: {
    where: { deletedAt: null, status: { not: "Cancelled" as const } },
    orderBy: { sequenceNo: "asc" as const },
    select: {
      id: true,
      sequenceNo: true,
      status: true,
      legType: true,
      closingKm: true,
      fromCity: cityRef,
      toCity: cityRef,
    },
  },
} satisfies Prisma.VehicleJourneySelect;

/** Fully-hydrated journey for the detail page. */
export const journeyInclude = {
  vehicle: { select: { id: true, vehicleNumber: true } },
  driver: { select: { id: true, name: true } },
  homeBranch: { select: { id: true, name: true, branchCode: true } },
  startCity: cityRef,
  returnCity: cityRef,
  currentCity: cityRef,
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  logSlip: { select: { id: true, logSlipNumber: true, status: true } },
  trips: {
    where: { deletedAt: null },
    orderBy: { sequenceNo: "asc" as const },
    select: journeyLegSelect,
  },
  expenses: {
    where: { deletedAt: null },
    orderBy: { expenseDate: "asc" as const },
    include: {
      city: cityRef,
      pump: { select: { id: true, name: true } },
      trip: { select: { id: true, tripNumber: true, sequenceNo: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  },
  advances: {
    orderBy: { paidAt: "asc" as const },
    include: {
      cashAccount: { select: { id: true, name: true } },
      trip: { select: { id: true, tripNumber: true, sequenceNo: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.VehicleJourneyInclude;

/* ------------------------------------------------------------------ */
/* Journey totals                                                     */
/* ------------------------------------------------------------------ */

export type JourneyTotals = {
  totalFreightPaise: bigint;
  totalAdvancePaise: bigint;
  totalDieselQty: number;
  totalDieselAmountPaise: bigint;
  totalCashExpensePaise: bigint;
  totalCreditExpensePaise: bigint;
  totalExpensePaise: bigint;
  driverCashExpensePaise: bigint;
  unapprovedExpenseCount: number;
  openLegCount: number;
};

/**
 * Running money totals for a journey.
 *
 * `approvedOnly` — the log slip freezes only APPROVED/POSTED expenses;
 * the live journey view includes DRAFT rows so the operator sees the real
 * running spend (REJECTED/REVERSED are always excluded).
 */
export const computeJourneyTotals = async (
  tx: Tx,
  journeyId: string,
  opts: { approvedOnly?: boolean } = {},
): Promise<JourneyTotals> => {
  const expenseStatuses = opts.approvedOnly
    ? (["APPROVED", "POSTED"] as const)
    : (["DRAFT", "APPROVED", "POSTED"] as const);

  const [freightAgg, advanceAgg, expenses, unapproved, openLegs] =
    await Promise.all([
      tx.vehicleTrip.aggregate({
        where: {
          journeyId,
          deletedAt: null,
          status: { not: "Cancelled" },
        },
        _sum: { onwardFreight: true },
      }),
      tx.driverAdvance.aggregate({
        where: { journeyId, status: "POSTED" },
        _sum: { amountPaise: true },
      }),
      tx.tripExpense.findMany({
        where: {
          journeyId,
          deletedAt: null,
          status: { in: [...expenseStatuses] },
        },
        select: {
          amountPaise: true,
          paymentMode: true,
          expenseType: { select: { requiresDieselDetails: true } },
          dieselQty: true,
          paidByDriver: true,
        },
      }),
      tx.tripExpense.count({
        where: { journeyId, deletedAt: null, status: "DRAFT" },
      }),
      tx.vehicleTrip.count({
        where: {
          journeyId,
          deletedAt: null,
          status: { notIn: ["Closed", "Cancelled"] },
        },
      }),
    ]);

  let totalDieselQty = 0;
  let totalDieselAmountPaise = 0n;
  let totalCashExpensePaise = 0n;
  let totalCreditExpensePaise = 0n;
  let totalExpensePaise = 0n;
  let driverCashExpensePaise = 0n;

  for (const e of expenses) {
    totalExpensePaise += e.amountPaise;
    if (e.expenseType.requiresDieselDetails) {
      totalDieselQty += e.dieselQty ?? 0;
      totalDieselAmountPaise += e.amountPaise;
    }
    if (e.paymentMode === "CASH") {
      totalCashExpensePaise += e.amountPaise;
      if (e.paidByDriver) driverCashExpensePaise += e.amountPaise;
    } else if (e.paymentMode === "CREDIT" || e.paymentMode === "CARD") {
      totalCreditExpensePaise += e.amountPaise;
    }
  }

  return {
    totalFreightPaise: freightAgg._sum.onwardFreight ?? 0n,
    totalAdvancePaise: advanceAgg._sum.amountPaise ?? 0n,
    totalDieselQty,
    totalDieselAmountPaise,
    totalCashExpensePaise,
    totalCreditExpensePaise,
    totalExpensePaise,
    driverCashExpensePaise,
    unapprovedExpenseCount: unapproved,
    openLegCount: openLegs,
  };
};

/* ------------------------------------------------------------------ */
/* Chain validation                                                   */
/* ------------------------------------------------------------------ */

type PrevLeg = {
  sequenceNo: number | null;
  toCityId: string | null;
  toCityName: string | null;
  closingKm: number | null;
  endDateTime: Date | null;
};

type NextLegInput = {
  fromCityId: string;
  fromCityName: string;
  openingKm: number;
  startDateTime?: Date;
};

/**
 * Backend-enforced continuity rules between consecutive legs (never UI-only):
 *   next fromCity   = previous toCity
 *   next openingKm  = previous closingKm + 1
 *   next start time > previous close time
 * Returns human-readable violations; the route requires an exception reason
 * plus `vehicle_journey.override_chain` to proceed despite them.
 */
export const chainViolations = (
  prev: PrevLeg,
  next: NextLegInput,
): string[] => {
  const violations: string[] = [];

  if (prev.toCityId && next.fromCityId !== prev.toCityId) {
    violations.push(
      `Leg starts from ${next.fromCityName} but the previous leg ended at ${prev.toCityName}`,
    );
  }
  if (prev.closingKm !== null && next.openingKm !== prev.closingKm + 1) {
    violations.push(
      `Opening KM ${next.openingKm} breaks continuity — expected ${prev.closingKm + 1} (previous closing KM + 1)`,
    );
  }
  if (
    prev.endDateTime &&
    next.startDateTime &&
    next.startDateTime <= prev.endDateTime
  ) {
    violations.push("Start time must be after the previous leg's close time");
  }

  return violations;
};

/** Journey statuses that block starting another journey for the same vehicle/driver. */
export const OPEN_JOURNEY_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "RETURNED",
  "READY_FOR_LOGSLIP",
  "REOPENED",
] as const;

/* ------------------------------------------------------------------ */
/* Close leg                                                          */
/* ------------------------------------------------------------------ */

type CloseLegArgs = {
  journey: {
    id: string;
    returnCityId: string;
    vehicleId: string;
    driverId: string;
  };
  trip: { id: string; toCityId: string | null };
  closingKm: number;
  endDateTime: Date;
  arrivalDateTime?: Date;
  unloadingCompletedAt?: Date;
  closeReason?: string;
  actorId: string;
};

/**
 * Close a journey leg and roll the journey forward. Closing at the configured
 * return city returns the journey and releases the vehicle/driver.
 */
export const closeLegAndUpdateJourney = async (
  args: CloseLegArgs,
): Promise<{ isReturnToBase: boolean }> => {
  const { journey, trip, actorId } = args;
  const isReturnToBase =
    trip.toCityId !== null && trip.toCityId === journey.returnCityId;

  await db.$transaction(async (tx) => {
    await tx.vehicleTrip.update({
      where: { id: trip.id },
      data: {
        status: "Closed",
        closingKm: args.closingKm,
        endDateTime: args.endDateTime,
        arrivalDateTime: args.arrivalDateTime ?? args.endDateTime,
        unloadingCompletedAt: args.unloadingCompletedAt ?? null,
        closedById: actorId,
        closeReason: args.closeReason ?? null,
        updatedById: actorId,
        version: { increment: 1 },
      },
      select: { id: true },
    });

    await tx.vehicle.update({
      where: { id: journey.vehicleId },
      data: {
        currentKM: args.closingKm,
        ...(isReturnToBase ? { status: "AVAILABLE" as const } : {}),
      },
    });

    if (isReturnToBase) {
      await tx.driver.update({
        where: { id: journey.driverId },
        data: { status: "AVAILABLE" },
      });
    }

    await tx.vehicleJourney.update({
      where: { id: journey.id },
      data: {
        ...(trip.toCityId ? { currentCityId: trip.toCityId } : {}),
        updatedById: actorId,
        version: { increment: 1 },
        ...(isReturnToBase
          ? {
              status: "RETURNED" as const,
              settlementStatus: "PENDING_REVIEW" as const,
              closingKm: args.closingKm,
              closedAt: args.endDateTime,
            }
          : {}),
      },
    });

    await writeTripStatus(
      tx,
      trip.id,
      actorId,
      "Closed",
      isReturnToBase ? "Leg closed - vehicle returned to base" : "Leg closed",
    );
  }, TX_BUDGET);

  return { isReturnToBase };
};
