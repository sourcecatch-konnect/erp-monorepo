import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

/** Amount in paise — positive integer. */
const amountPaise = z
  .union([z.string(), z.number()])
  .transform((v) => Number(v))
  .refine((v) => Number.isInteger(v) && v >= 0, {
    message: "Amount must be a non-negative whole number of paise",
  });

/* -----------------------------
   RECEIVABLE ENTITY (DB / API)
   Global — not tied to a cash-plan day.
------------------------------ */
export const cashReceivableSchema = z.object({
  id: z.string(),
  partyName: z.string(),
  source: z.enum(["MANUAL", "BILL"]).default("MANUAL"), // NEW
  billId: z.string().nullable().optional(), // NEW
  customerId: z.string().nullable().optional(), // NEW
  totalAmount: z.number(), // total still to receive (paise)
  expectedAmount: z.number(), // slice expected by expectedDate (paise)
  expectedDate: z.date().nullable().optional(),
  receivedAmount: z.number().nullable().optional(),
  ackReceived: z.boolean(),
  note: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/* -----------------------------
   RECEIPT (one slice in the timeline / audit trail)
------------------------------ */
export const cashReceiptSchema = z.object({
  id: z.string(),
  receivableId: z.string(),
  amount: z.number(), // paise received this slice
  receivedAt: z.date(),
  note: z.string().nullable().optional(),
  createdAt: z.date(),
});

/* -----------------------------
   CREATE / UPDATE
   Unchanged — manual entry never sets source/billId/customerId directly;
   the backend sets those only when syncing from a finalised Bill.
------------------------------ */
const cashReceivableFields = z.object({
  partyName: z
    .string()
    .trim()
    .min(1, "Party is required")
    .max(120, "Party name cannot exceed 120 characters"),

  totalAmount: amountPaise,

  expectedAmount: amountPaise.optional().default(0),

  expectedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .optional(),

  note: optionalString,
});

/** expected slice must never exceed the total still owed. */
const expectedWithinTotal = (v: {
  totalAmount?: number;
  expectedAmount?: number;
}) =>
  v.totalAmount === undefined ||
  v.expectedAmount === undefined ||
  v.expectedAmount <= v.totalAmount;

const expectedWithinTotalError = {
  message: "Expected amount cannot exceed the total amount",
  path: ["expectedAmount"],
};

export const createCashReceivableSchema = cashReceivableFields.refine(
  expectedWithinTotal,
  expectedWithinTotalError,
);

export const updateCashReceivableSchema = cashReceivableFields
  .partial()
  .refine(expectedWithinTotal, expectedWithinTotalError);

/* -----------------------------
   RECEIVE (record a receipt against the outstanding total)
------------------------------ */
const receivedAmountPaise = z
  .union([z.string(), z.number()])
  .transform((v) => Number(v))
  .refine((v) => Number.isInteger(v) && v > 0, {
    message: "Received amount must be a positive whole number of paise",
  });

export const markReceivableReceivedSchema = z.object({
  receivedAmount: receivedAmountPaise,
});