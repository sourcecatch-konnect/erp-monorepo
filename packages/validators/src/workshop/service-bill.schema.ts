import { z } from "zod";
import { paymentModeSchema } from "../cash/creditor.schema.js";

const id = z.string().trim().min(1);
const isoDate = z.coerce.date();
const paise = z.coerce.bigint().min(0n);
const positivePaise = z.coerce.bigint().positive();

export const serviceBillStatusSchema = z.enum(["DRAFT", "POSTED", "CANCELLED"]);

export const unbilledServiceLinesQuerySchema = z.object({
  serviceProviderId: id,
  uptoDate: isoDate.optional(),
  branchId: id.optional(),
});

export const createServiceBillSchema = z.object({
  branchId: id,
  serviceProviderId: id,
  billDate: isoDate,
  providerInvoiceNo: z.string().trim().min(1, "Provider's bill number is required"),
  providerInvoiceDate: isoDate.optional(),
  discountPaise: paise.default(0n),
  remarks: z.string().trim().max(1000).optional(),
  jobCardServiceLineIds: z
    .array(id)
    .min(1, "Select at least one completed service to bill"),
});

export const serviceBillListQuerySchema = z.object({
  branchId: id.optional(),
  serviceProviderId: id.optional(),
  status: serviceBillStatusSchema.optional(),
  page: z.coerce.number().int().min(0).default(0),
  size: z.coerce.number().int().min(1).max(100).default(10),
});

export const cancelServiceBillSchema = z.object({
  reason: z.string().trim().min(1, "Cancellation reason is required").max(500),
});

export const createServiceBillPaymentSchema = z.object({
  paidPaise: positivePaise,
  tdsPaise: paise.default(0n),
  paymentMode: paymentModeSchema,
  paymentDate: isoDate,
  referenceNumber: z.string().trim().max(120).optional(),
  fromAccountId: id,
  remarks: z.string().trim().max(500).optional(),
});
