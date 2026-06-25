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
------------------------------ */
export const cashReceivableSchema = z.object({
  id: z.string(),
  dayId: z.string(),
  partyName: z.string(),
  amount: z.number(), // paise
  expectedDate: z.date().nullable().optional(),
  receivedAmount: z.number().nullable().optional(),
  ackReceived: z.boolean(),
  note: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/* -----------------------------
   CREATE / UPDATE
   (dayId comes from the route param)
------------------------------ */
export const createCashReceivableSchema = z.object({
  partyName: z
    .string()
    .trim()
    .min(1, "Party is required")
    .max(120, "Party name cannot exceed 120 characters"),

  amount: amountPaise,

  expectedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .optional(),

  note: optionalString,
});

export const updateCashReceivableSchema = createCashReceivableSchema.partial();

/* -----------------------------
   MARK RECEIVED
------------------------------ */
export const markReceivableReceivedSchema = z.object({
  receivedAmount: amountPaise,
  ackReceived: z.boolean().optional().default(true),
});
