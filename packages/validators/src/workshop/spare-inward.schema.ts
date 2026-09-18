import { z } from "zod";

const id = z.string().trim().min(1);
const isoDate = z.coerce.date();
const paise = z.coerce.bigint().min(0n);

export const spareInwardStatusSchema = z.enum(["DRAFT", "POSTED", "CANCELLED"]);

export const spareInwardLineInputSchema = z.object({
  poLineId: id,
  sparePartId: id,
  qtyReceived: z.coerce.number().int().min(0),
  qtyRejected: z.coerce.number().int().min(0).default(0),
  ratePaise: paise,
  batchNo: z.string().trim().max(80).optional(),
  warrantyExpiry: isoDate.optional(),
  guaranteeExpiry: isoDate.optional(),
});

export const createSpareInwardSchema = z.object({
  poId: id,
  inwardDate: isoDate,
  supplierInvoiceNo: z.string().trim().min(1, "Supplier invoice number is required"),
  supplierInvoiceDate: isoDate.optional(),
  discountPaise: paise.default(0n),
  remarks: z.string().trim().max(1000).optional(),
  lines: z
    .array(spareInwardLineInputSchema)
    .min(1, "At least one line is required")
    .refine((lines) => lines.some((l) => l.qtyReceived > 0), {
      message: "At least one line must have a received quantity",
    })
    .refine((lines) => lines.every((l) => l.qtyReceived === 0 || Boolean(l.batchNo?.trim())), {
      message: "Batch number is required for every line being received",
    }),
});

export const spareInwardListQuerySchema = z.object({
  branchId: id.optional(),
  poId: id.optional(),
  supplierId: id.optional(),
  status: spareInwardStatusSchema.optional(),
});

export const cancelSpareInwardSchema = z.object({
  reason: z.string().trim().min(1, "Cancellation reason is required").max(500),
});

/** Stock browse screen (Task 3) — filters for `GET /spare-inward/stock`. */
export const stockListQuerySchema = z.object({
  branchId: id.optional(),
  search: z.string().trim().max(200).optional(),
});
