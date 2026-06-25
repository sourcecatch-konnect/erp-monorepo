import { z } from "zod";

/* -----------------------------
   SHARED ENUMS (mirror Prisma)
------------------------------ */
export const creditorCategorySchema = z.enum([
  "DIESEL",
  "RENT",
  "FREIGHT",
  "EXPENSE",
  "REPAIR",
  "OTHER",
]);

export const paymentModeSchema = z.enum(["CASH", "BANK", "UPI", "CHEQUE"]);

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

/** Rupee number on input (server converts to paise via beforeCreate hook). */
const optionalRupees = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === "" || v === null || v === undefined) return undefined;
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  });

/* -----------------------------
   CREDITOR ENTITY (DB / API)
------------------------------ */
export const creditorSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: creditorCategorySchema,
  defaultMode: paymentModeSchema.nullable().optional(),
  branchId: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  outstandingBalance: z.number(), // paise
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/* -----------------------------
   CREATE / UPDATE
------------------------------ */
export const createCreditorSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Creditor name is required")
    .max(120, "Creditor name cannot exceed 120 characters"),

  category: creditorCategorySchema,

  defaultMode: paymentModeSchema.optional(),

  branchId: optionalString,

  phone: optionalString.refine(
    (v) => !v || /^[0-9]{10,15}$/.test(v),
    "Enter a valid phone number"
  ),

  // Outstanding owed, entered in rupees; server converts to paise.
  outstandingBalance: optionalRupees.refine(
    (v) => v === undefined || v >= 0,
    "Outstanding cannot be negative",
  ),

  isActive: z.boolean().optional().default(true),
});

export const updateCreditorSchema = createCreditorSchema.partial();
