import { z } from "zod";

const id = z.string().trim().min(1);
const isoDate = z.coerce.date();
const paise = z.coerce.bigint().min(0n);

export const replacementListStatusSchema = z.enum([
  "PENDING",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELLED",
]);
export const replacementTypeSchema = z.enum(["FREE", "PAYABLE", "CREDIT_NOTE"]);

export const replacementListLineInputSchema = z.object({
  sparePartId: id,
  originalInwardLineId: id,
  qtyRequested: z.coerce.number().int().positive(),
  replacementType: replacementTypeSchema,
  remarks: z.string().trim().max(500).optional(),
});

export const createReplacementListSchema = z.object({
  branchId: id,
  supplierId: id,
  originalInwardId: id,
  requestDate: isoDate,
  remarks: z.string().trim().max(1000).optional(),
  lines: z.array(replacementListLineInputSchema).min(1, "At least one line is required"),
});

export const replacementListQuerySchema = z.object({
  branchId: id.optional(),
  supplierId: id.optional(),
  status: replacementListStatusSchema.optional(),
  page: z.coerce.number().int().min(0).default(0),
  size: z.coerce.number().int().min(1).max(100).default(10),
});

export const cancelReplacementListSchema = z.object({
  reason: z.string().trim().min(1, "Cancellation reason is required").max(500),
});

export const replacementInwardLineInputSchema = z.object({
  replacementListLineId: id,
  qtyReceived: z.coerce.number().int().positive(),
  differentialRatePaise: paise.default(0n),
  batchNo: z.string().trim().max(80).optional(),
  warrantyExpiry: isoDate.optional(),
  guaranteeExpiry: isoDate.optional(),
});

export const createReplacementInwardSchema = z.object({
  replacementListId: id,
  inwardDate: isoDate,
  supplierChallanNo: z.string().trim().max(120).optional(),
  supplierChallanDate: isoDate.optional(),
  remarks: z.string().trim().max(1000).optional(),
  lines: z.array(replacementInwardLineInputSchema).min(1, "At least one line is required"),
});

export const replacementInwardQuerySchema = z.object({
  branchId: id.optional(),
  replacementListId: id.optional(),
  page: z.coerce.number().int().min(0).default(0),
  size: z.coerce.number().int().min(1).max(100).default(10),
});

/** A CREDIT_NOTE line never gets a physical batch back — this posts a
 *  ledger voucher against a set of CREDIT_NOTE-type list lines instead of
 *  going through /replacement-inward. */
export const creditNoteLineInputSchema = z.object({
  replacementListLineId: id,
  amountPaise: paise.refine((v) => v > 0n, "Amount must be greater than zero"),
});

export const createReplacementCreditNoteSchema = z.object({
  creditNoteDate: isoDate,
  supplierChallanNo: z.string().trim().max(120).optional(),
  remarks: z.string().trim().max(1000).optional(),
  lines: z.array(creditNoteLineInputSchema).min(1, "At least one line is required"),
});
