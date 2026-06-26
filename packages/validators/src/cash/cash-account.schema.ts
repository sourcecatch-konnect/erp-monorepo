import { z } from "zod";

/* -----------------------------
   ENUM (mirror Prisma)
------------------------------ */
export const cashAccountTypeSchema = z.enum(["BANK", "CASH"]);

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

/* -----------------------------
   CASH ACCOUNT ENTITY (DB / API)
------------------------------ */
export const cashAccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: cashAccountTypeSchema,
  bankName: z.string().nullable().optional(),
  accountLast4: z.string().nullable().optional(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/* -----------------------------
   CREATE / UPDATE
------------------------------ */
export const createCashAccountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Account name is required")
    .max(120, "Account name cannot exceed 120 characters"),

  type: cashAccountTypeSchema,

  bankName: optionalString.refine(
    (v) => !v || v.length <= 80,
    "Bank name cannot exceed 80 characters"
  ),

  accountLast4: optionalString.refine(
    (v) => !v || /^[0-9]{4}$/.test(v),
    "Enter the last 4 digits of the account number"
  ),

  isActive: z.boolean().optional().default(true),
});

export const updateCashAccountSchema = createCashAccountSchema.partial();
