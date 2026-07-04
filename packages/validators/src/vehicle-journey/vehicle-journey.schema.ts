import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const optionalDate = z
  .union([z.string(), z.date()])
  .optional()
  .transform((value) => {
    if (value === "" || value === undefined || value === null) return undefined;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  });

const positiveIntField = (label: string) =>
  z
    .union([z.string(), z.number()])
    .transform((value) => Number(value))
    .refine(
      (value) => Number.isInteger(value) && value > 0,
      `${label} must be a positive whole number`,
    );

/* ------------------------------------------------------------------ */
/* Enums                                                              */
/* ------------------------------------------------------------------ */

export const vehicleJourneyStatusSchema = z.enum([
  "DRAFT",
  "ACTIVE",
  "RETURNED",
  "READY_FOR_LOGSLIP",
  "SETTLED",
  "REOPENED",
  "CANCELLED",
]);

export const journeySettlementStatusSchema = z.enum([
  "NOT_READY",
  "PENDING_REVIEW",
  "READY",
  "GENERATED",
  "POSTED",
  "TALLY_SYNCED",
]);

export const tripLegTypeSchema = z.enum([
  "LR",
  "DC",
  "EMPTY",
  "LOCAL",
  "RETURN",
  "WORKSHOP",
  "OTHER",
]);

/* ------------------------------------------------------------------ */
/* Leg transitions                                                    */
/*                                                                    */
/* Journeys are never created directly — every trip belongs to one:   */
/* creating a trip auto-attaches it to the vehicle's active journey   */
/* or auto-opens a new journey based from the head-office city.       */
/* ------------------------------------------------------------------ */

export const closeJourneyLegSchema = z.object({
  closingKm: positiveIntField("Closing KM"),
  endDateTime: optionalDate,
  arrivalDateTime: optionalDate,
  unloadingCompletedAt: optionalDate,
  closeReason: optionalString,
});

export const dispatchJourneyLegSchema = z.object({
  startDateTime: optionalDate,
});

/* ------------------------------------------------------------------ */
/* Journey                                                            */
/* ------------------------------------------------------------------ */

export const cancelJourneySchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Please give a reason (min 3 characters)")
    .max(500, "Reason is too long"),
});

/**
 * Force-close a journey away from the head-office base (non-base closure).
 * Extreme rare case; requires an explicit reason and the
 * `vehicle_journey.close` permission.
 */
export const closeJourneySchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Please give a reason (min 3 characters)")
    .max(500, "Reason is too long"),
});
