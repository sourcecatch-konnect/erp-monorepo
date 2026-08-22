import { z } from "zod";

/* -----------------------------
   ENUM (mirror Prisma)
------------------------------ */
export const cashDayStatusSchema = z.enum(["OPEN", "CLOSED"]);

/** Balance in paise — whole number, may be negative for overdrawn cash. */
const balancePaise = z
  .union([z.string(), z.number()])
  .transform((v) => Number(v))
  .refine((v) => Number.isInteger(v), {
    message: "Balance must be a whole number of paise",
  });

/* -----------------------------
   PER-ACCOUNT OPENING BALANCE
------------------------------ */
export const cashAccountBalanceSchema = z.object({
  id: z.string(),
  dayId: z.string(),
  accountId: z.string(),
  openingBalance: z.number(), // paise
  carriedOpening: z.number().nullable().optional(), // paise
});

/* -----------------------------
   CASH PLAN DAY ENTITY (DB / API)
------------------------------ */
export const cashPlanDaySchema = z.object({
  id: z.string(),
  date: z.date(),
  status: cashDayStatusSchema,
  closedAt: z.date().nullable().optional(),
  closedById: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/* -----------------------------
   OPEN A DAY
   date as ISO yyyy-mm-dd; balances optional (else carried/zero seeded server-side)
------------------------------ */
export const openCashDaySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
});

/* -----------------------------
   UPSERT OPENING BALANCES
   one row per account; openingBalance overrides the carried value
------------------------------ */
export const upsertCashBalancesSchema = z.object({
  balances: z
    .array(
      z.object({
        accountId: z.string().min(1, "Account is required"),
        openingBalance: balancePaise,
      })
    )
    .min(1, "At least one account balance is required"),
});

/* -----------------------------
   CLOSE A DAY
------------------------------ */
export const closeCashDaySchema = z.object({
  confirm: z.literal(true),
});

/* -----------------------------
   ACCOUNT ADJUSTMENT (manual add funds / correction)
   Signed — positive adds to the account, negative corrects it down.
------------------------------ */
export const cashAccountAdjustmentSchema = z.object({
  id: z.string(),
  dayId: z.string(),
  accountId: z.string(),
  amountPaise: z.number(),
  reason: z.string(),
  receiptId: z.string().nullable().optional(),
  createdById: z.string(),
  createdAt: z.date(),
});

export const createCashAccountAdjustmentSchema = z.object({
  amountPaise: z
    .union([z.string(), z.number()])
    .transform((v) => Number(v))
    .refine((v) => Number.isInteger(v) && v !== 0, {
      message: "Amount must be a non-zero whole number of paise",
    }),
  reason: z
    .string()
    .trim()
    .min(3, "Reason is required")
    .max(280, "Reason cannot exceed 280 characters"),
});
