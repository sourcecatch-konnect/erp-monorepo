import { z } from "zod";
import { rupeesToPaise, optionalRupeesToPaise } from "../_shared/money.js";

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

const reasonSchema = z
  .string()
  .trim()
  .min(3, "Please give a reason (min 3 characters)")
  .max(500, "Reason is too long");

/* ------------------------------------------------------------------ */
/* Enums                                                              */
/* ------------------------------------------------------------------ */

export const tripPaymentModeSchema = z.enum([
  "CASH",
  "BANK",
  "CARD",
  "UPI",
  "CREDIT",
]);

export const tripExpenseStatusSchema = z.enum([
  "DRAFT",
  "APPROVED",
  "REJECTED",
  "POSTED",
  "REVERSED",
]);

export const driverAdvanceStatusSchema = z.enum([
  "DRAFT",
  "POSTED",
  "REVERSED",
]);

/* ------------------------------------------------------------------ */
/* Trip expense                                                       */
/* ------------------------------------------------------------------ */

const expenseBaseShape = {
  journeyId: z.string().min(1, "Journey is required"),
  tripId: optionalString,
  expenseTypeId: z.string().min(1, "Expense type is required"),
  // Entered in rupees, stored as paise.
  amount: rupeesToPaise("Amount"),
  paymentMode: tripPaymentModeSchema,
  cityId: optionalString,
  pumpId: optionalString,
  dieselQty: optionalPositiveNumber("Diesel quantity"),
  dieselRate: optionalRupeesToPaise("Diesel rate"),
  expenseDate: optionalDate,
  receiptNo: optionalString,
  // Cash paid out of the driver's advance — settles at log slip time.
  paidByDriver: z.boolean().optional().default(true),
  remarks: optionalString,
};

export const createTripExpenseSchema = z.object(expenseBaseShape);

export const updateTripExpenseSchema = z.object(expenseBaseShape);

export const createTripExpenseTypeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Expense type name must be at least 2 characters")
    .max(80, "Expense type name is too long"),
});

export const rejectTripExpenseSchema = z.object({ reason: reasonSchema });
export const reverseTripExpenseSchema = z.object({ reason: reasonSchema });

/* ------------------------------------------------------------------ */
/* Driver advance                                                     */
/* ------------------------------------------------------------------ */

// Advances are money handed over — CREDIT is not a valid advance mode.
export const advancePaymentModeSchema = z.enum(["CASH", "BANK", "CARD", "UPI"]);

export const createDriverAdvanceSchema = z.object({
  journeyId: z.string().min(1, "Journey is required"),
  tripId: optionalString,
  // Entered in rupees, stored as paise.
  amount: rupeesToPaise("Advance amount"),
  paymentMode: advancePaymentModeSchema,
  cashAccountId: optionalString,
  paidAt: optionalDate,
  narration: optionalString,
});

export const reverseDriverAdvanceSchema = z.object({ reason: reasonSchema });
