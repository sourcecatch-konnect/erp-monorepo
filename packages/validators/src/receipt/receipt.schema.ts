import { z } from "zod";

export const receiptPaymentModeSchema = z.enum([
  "CASH",
  "CHEQUE",
  "BANK",
  "UPI",
]);

const id = z.string().trim().min(1);
const isoDate = z.coerce.date();
const paise = z.coerce.bigint().min(0n);
// Rate difference can go either way: positive when the actual agreed rate
// was lower than the billed rate (a deduction), negative when it was higher
// (the client actually paid more than the bill shows).
const signedPaise = z.coerce.bigint();

export const outstandingBillsQuerySchema = z.object({
  branchId: id,
  customerId: id,
  truckNumber: z.string().trim().optional(),
  lrNumber: z.string().trim().optional(),
  billNumber: z.string().trim().optional(),
  uptoDate: isoDate.optional(),
});

export const createReceiptSchema = z.object({
  branchId: id,
  customerId: id,
  receivedAt: isoDate,
  paymentMode: receiptPaymentModeSchema,
  receivedIntoAccountId: id,
  referenceNumber: z.string().trim().max(120).optional(),
  remarks: z.string().trim().max(1000).optional(),
  allocations: z
    .array(
      z.object({
        billId: id,
        amountAppliedPaise: paise,
        tdsAmountPaise: paise.default(0n),
        tdsSection: z.string().trim().max(20).optional(),
        damageAmountPaise: paise.default(0n),
        rateDiffAmountPaise: signedPaise.default(0n),
      }),
    )
    .min(1)
    .max(200),
});

export const approveReceiptSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const cancelReceiptSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export type OutstandingBillsQuery = z.infer<typeof outstandingBillsQuerySchema>;
export type CreateReceiptInput = z.infer<typeof createReceiptSchema>;
export type ApproveReceiptInput = z.infer<typeof approveReceiptSchema>;
export type CancelReceiptInput = z.infer<typeof cancelReceiptSchema>;
