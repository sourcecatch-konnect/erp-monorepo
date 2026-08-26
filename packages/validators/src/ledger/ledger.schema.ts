import { z } from "zod";

import { creditorCategorySchema } from "../cash/creditor.schema.js";

/* -----------------------------
   ENUMS (mirror Prisma)
------------------------------ */
export const ledgerDirectionSchema = z.enum(["IN", "OUT"]);
export const ledgerSourceTypeSchema = z.enum(["RECEIPT", "PAYMENT", "ADJUSTMENT"]);

/* -----------------------------
   LEDGER ENTRY (DB / API) — read-only, no create/update body:
   rows are only ever written by the server via recordLedgerEntry.
------------------------------ */
export const ledgerEntrySchema = z.object({
  id: z.string(),
  occurredAt: z.date(),
  direction: ledgerDirectionSchema,
  amountPaise: z.number(),
  cashAccountId: z.string().nullable(),
  customerId: z.string().nullable(),
  creditorId: z.string().nullable(),
  category: creditorCategorySchema.nullable(),
  sourceType: ledgerSourceTypeSchema,
  sourceId: z.string(),
  description: z.string(),
  createdById: z.string(),
  createdAt: z.date(),
});

/* -----------------------------
   OPTIONAL DATE-RANGE FILTER for the 4 read endpoints
------------------------------ */
export const ledgerQuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "from must be in YYYY-MM-DD format")
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "to must be in YYYY-MM-DD format")
    .optional(),
});
