import { z } from "zod";
import { creditorCategorySchema, paymentModeSchema } from "./creditor.schema.js";

/* -----------------------------
   ENUM (mirror Prisma)
------------------------------ */
export const paymentStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "HOLD",
  "REJECTED",
]);

export const cashSegmentSchema = z.enum(["ROAD", "RAIL", "FCI"]);

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

/** Amount in paise — positive integer, no fractional paise. */
const amountPaise = z
  .union([z.string(), z.number()])
  .transform((v) => Number(v))
  .refine((v) => Number.isInteger(v) && v > 0, {
    message: "Amount must be a positive whole number of paise",
  });

/* -----------------------------
   PAYMENT ENTITY (DB / API)
------------------------------ */
export const cashPaymentSchema = z.object({
  id: z.string(),
  dayId: z.string(),
  creditorId: z.string().nullable().optional(),
  payeeName: z.string(),
  amount: z.number(), // paise
  category: creditorCategorySchema,
  mode: paymentModeSchema,
  segment: cashSegmentSchema.nullable().optional(),
  projectCode: z.string().nullable().optional(),
  priority: z.number(),
  branchId: z.string().nullable().optional(),
  fromAccountId: z.string().nullable().optional(),
  status: paymentStatusSchema,
  isLate: z.boolean(),
  note: z.string().nullable().optional(),
  approvedById: z.string().nullable().optional(),
  approvedAt: z.date().nullable().optional(),
  createdById: z.string().nullable().optional(),
  journalEntryId: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/* -----------------------------
   CREATE / UPDATE
   (dayId comes from the route param, not the body)
------------------------------ */
export const createCashPaymentSchema = z.object({
  creditorId: optionalString,

  payeeName: z
    .string()
    .trim()
    .min(1, "Payee is required")
    .max(120, "Payee name cannot exceed 120 characters"),

  amount: amountPaise,

  category: creditorCategorySchema,

  mode: paymentModeSchema,

  segment: cashSegmentSchema.optional(),

  projectCode: optionalString.refine(
    (v) => !v || v.length <= 40,
    "Project code cannot exceed 40 characters",
  ),

  branchId: optionalString,

  fromAccountId: z
    .string()
    .trim()
    .min(1, "Select which cash account this payment draws from"),

  note: optionalString.refine(
    (v) => !v || v.length <= 280,
    "Note cannot exceed 280 characters"
  ),
});

export const updateCashPaymentSchema = createCashPaymentSchema.partial();

/* -----------------------------
   STATUS CHANGE (approve / hold / reject)
------------------------------ */
export const cashPaymentStatusUpdateSchema = z.object({
  status: paymentStatusSchema,
  note: optionalString,
});

/* -----------------------------
   REORDER (priority queue)
------------------------------ */
export const reorderCashPaymentsSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1, "orderedIds is required"),
});

/* -----------------------------
   BULK APPROVE (approve all that fit, one round-trip)
------------------------------ */
export const bulkApproveCashPaymentsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "ids is required"),
});
