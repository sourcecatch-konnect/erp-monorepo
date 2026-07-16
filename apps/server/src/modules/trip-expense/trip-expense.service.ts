import { Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import { BadRequestError, NotFoundError } from "../../lib/error.js";

/** Hydrated expense row for lists and mutation responses. */
export const tripExpenseInclude = {
  expenseType: {
    select: {
      id: true,
      code: true,
      name: true,
      requiresDieselDetails: true,
      isSystem: true,
      isActive: true,
      sortOrder: true,
    },
  },
  city: { select: { id: true, name: true } },
  pump: { select: { id: true, name: true } },
  trip: { select: { id: true, tripNumber: true, sequenceNo: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.TripExpenseInclude;

export const loadActiveExpenseType = async (
  expenseTypeId: string,
  dieselQty?: number,
) => {
  const expenseType = await db.tripExpenseType.findFirst({
    where: { id: expenseTypeId, isActive: true },
  });
  if (!expenseType) throw new BadRequestError("Expense type is not available");
  if (expenseType.requiresDieselDetails && !dieselQty) {
    throw new BadRequestError(
      "Diesel quantity is required for a diesel expense",
    );
  }
  return expenseType;
};

/** Hydrated advance row for lists and mutation responses. */
export const driverAdvanceInclude = {
  cashAccount: { select: { id: true, name: true } },
  trip: { select: { id: true, tripNumber: true, sequenceNo: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.DriverAdvanceInclude;

/**
 * Money can be captured while the journey is running or under settlement
 * review — never once the log slip snapshot exists (reopen it instead).
 */
export const loadJourneyForMoneyEntry = async (journeyId: string) => {
  const journey = await db.vehicleJourney.findFirst({
    where: { id: journeyId, deletedAt: null },
    select: {
      id: true,
      status: true,
      settlementStatus: true,
      vehicleId: true,
      driverId: true,
    },
  });
  if (!journey) throw new NotFoundError("Journey not found");
  if (!["ACTIVE", "RETURNED"].includes(journey.status)) {
    throw new BadRequestError(
      `Money entries are locked once the journey is ${journey.status.toLowerCase().replace(/_/g, " ")} — reopen the log slip to amend`,
    );
  }
  return journey;
};

/** A tripId passed with a money entry must be a leg of the same journey. */
export const assertTripInJourney = async (
  tripId: string,
  journeyId: string,
) => {
  const trip = await db.vehicleTrip.findFirst({
    where: { id: tripId, journeyId, deletedAt: null },
    select: { id: true },
  });
  if (!trip) {
    throw new BadRequestError("Trip leg does not belong to this journey");
  }
};
