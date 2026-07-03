import { z } from "zod";
import { optionalRupeesToPaise } from "../_shared/money.js";

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

const nonNegativeNumber = (label: string) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === "" || value === undefined || value === null) return 0;
      return Number(value);
    })
    .refine(
      (value) => Number.isFinite(value) && value >= 0,
      `${label} must be a non-negative number`,
    );

const optionalPositiveNumber = (label: string) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === "" || value === undefined || value === null) {
        return undefined;
      }
      return Number(value);
    })
    .refine(
      (value) => value === undefined || (Number.isFinite(value) && value > 0),
      `${label} must be a positive number`,
    );

/* ------------------------------------------------------------------ */
/* Enums                                                              */
/* ------------------------------------------------------------------ */

export const logSlipStatusSchema = z.enum([
  "DRAFT",
  "GENERATED",
  "POSTED_TO_ACCOUNTS",
  "TALLY_SYNCED",
  "REOPENED",
  "CANCELLED",
]);

export const logSlipLineTypeSchema = z.enum([
  "TRIP_FREIGHT",
  "ADVANCE",
  "DIESEL",
  "EXPENSE",
  "DRIVER_SETTLEMENT",
  "ADJUSTMENT",
]);

/* ------------------------------------------------------------------ */
/* Actions                                                            */
/* ------------------------------------------------------------------ */

/**
 * Inputs the accounts user reviews/enters at generation time. Everything
 * else (freight, advances, expenses, KM) is computed from the journey.
 */
export const generateLogSlipSchema = z.object({
  logSlipDate: optionalDate,
  // Diesel left in the tank from the previous journey.
  previousDieselQty: nonNegativeNumber("Previous diesel quantity"),
  dieselRate: optionalRupeesToPaise("Diesel rate"),
  // Vehicle's standard KM-per-litre benchmark for the short-diesel figure.
  standardAverage: optionalPositiveNumber("Standard average"),
  remarks: optionalString,
});

export const reopenLogSlipSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Please give a reason (min 3 characters)")
    .max(500, "Reason is too long"),
});
