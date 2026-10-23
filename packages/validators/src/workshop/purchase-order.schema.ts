import { z } from "zod";

const id = z.string().trim().min(1);
const isoDate = z.coerce.date();
const paise = z.coerce.bigint().min(0n);

export const purchaseOrderStatusSchema = z.enum([
  "DRAFT",
  "APPROVED",
  "SENT",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CLOSED",
  "CANCELLED",
]);

export const purchaseOrderLineInputSchema = z.object({
  sparePartId: id,
  qtyOrdered: z.coerce.number().int().positive(),
  ratePaise: paise,
});

export const createPurchaseOrderSchema = z.object({
  branchId: id,
  supplierId: id,
  poDate: isoDate,
  expectedDate: isoDate.optional(),
  remarks: z.string().trim().max(1000).optional(),
  lines: z.array(purchaseOrderLineInputSchema).min(1, "At least one line is required"),
});

export const updatePurchaseOrderSchema = createPurchaseOrderSchema.partial({
  branchId: true,
  supplierId: true,
  poDate: true,
  lines: true,
});

export const purchaseOrderListQuerySchema = z.object({
  branchId: id.optional(),
  supplierId: id.optional(),
  status: purchaseOrderStatusSchema.optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(0).default(0),
  size: z.coerce.number().int().min(1).max(100).default(10),
});

export const cancelPurchaseOrderSchema = z.object({
  reason: z.string().trim().min(1, "Cancellation reason is required").max(500),
});
