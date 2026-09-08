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

/* -----------------------------
   DOUBLE-ENTRY LEDGER (chart of accounts / voucher) — Phase 4 (mirror Prisma)
------------------------------ */
export const ledgerKindSchema = z.enum(["PARTY", "GL"]);
export const ledgerAccountGroupSchema = z.enum([
  "SUNDRY_DEBTOR",
  "SUNDRY_CREDITOR",
  "DIRECT_INCOME",
  "INDIRECT_INCOME",
  "DIRECT_EXPENSE",
  "INDIRECT_EXPENSE",
  "DUTIES_AND_TAXES",
  "BANK",
  "CASH",
  "CURRENT_ASSET",
  "CURRENT_LIABILITY",
]);
export const voucherTypeSchema = z.enum([
  "SALES",
  "RECEIPT",
  "PAYMENT",
  "JOURNAL",
  "CONTRA",
  "CREDIT_NOTE",
  "DEBIT_NOTE",
]);
export const journalStatusSchema = z.enum(["DRAFT", "POSTED", "REVERSED"]);

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be in YYYY-MM-DD format");

/** Browse/search the chart of accounts. */
export const chartOfAccountsQuerySchema = z.object({
  kind: ledgerKindSchema.optional(),
  group: ledgerAccountGroupSchema.optional(),
  search: z.string().trim().max(120).optional(),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

/** Create a manual GL ledger head — party ledgers are lazy-created by the
 *  posting service and cannot be created here. */
export const createGLLedgerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  group: ledgerAccountGroupSchema,
  code: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[A-Z0-9_]+$/, "code must be UPPER_SNAKE_CASE")
    .optional(),
  branchId: z.string().trim().min(1).optional(),
});

export const updateLedgerSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  group: ledgerAccountGroupSchema.optional(),
  code: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[A-Z0-9_]+$/, "code must be UPPER_SNAKE_CASE")
    .nullable()
    .optional(),
  isActive: z.boolean().optional(),
});

/** One line of a free-form Manual Journal voucher — exactly one of
 *  debit/credit is checked by the posting service, not here. */
export const manualJournalLineSchema = z.object({
  ledgerId: z.string().trim().min(1),
  debitPaise: z.coerce.bigint().min(0n).default(0n),
  creditPaise: z.coerce.bigint().min(0n).default(0n),
  narration: z.string().trim().max(200).optional(),
});

export const createManualJournalSchema = z.object({
  branchId: z.string().trim().min(1),
  voucherDate: z.coerce.date(),
  narration: z.string().trim().max(500).optional(),
  lines: z.array(manualJournalLineSchema).min(2).max(50),
});

export const dayBookQuerySchema = z.object({
  from: dateOnly,
  to: dateOnly.optional(),
  branchId: z.string().trim().min(1).optional(),
  voucherType: voucherTypeSchema.optional(),
});

export type ChartOfAccountsQuery = z.infer<typeof chartOfAccountsQuerySchema>;
export type CreateGLLedgerInput = z.infer<typeof createGLLedgerSchema>;
export type UpdateLedgerInput = z.infer<typeof updateLedgerSchema>;
export type CreateManualJournalInput = z.infer<typeof createManualJournalSchema>;
export type DayBookQuery = z.infer<typeof dayBookQuerySchema>;
