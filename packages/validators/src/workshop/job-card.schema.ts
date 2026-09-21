import { z } from "zod";

const id = z.string().trim().min(1);
const isoDate = z.coerce.date();
const positivePaise = z.coerce.bigint().positive();

export const jobCardStatusSchema = z.enum(["DRAFT", "FINALISED", "CANCELLED"]);
export const truckLocationStatusSchema = z.enum(["AT_HO", "IN_TRANSIT"]);

export const jobCardPartLineInputSchema = z.object({
  sparePartId: id,
  batchId: id,
  mechanicId: id.optional(),
  qty: z.coerce.number().int().positive(),
  description: z.string().trim().max(500).optional(),
});

export const jobCardServiceLineInputSchema = z.object({
  serviceProviderId: id,
  sparePartId: id,
  mechanicId: id.optional(),
  qty: z.coerce.number().int().positive(),
  ratePaise: positivePaise,
  description: z.string().trim().max(500).optional(),
});

export const createJobCardSchema = z.object({
  branchId: id,
  vehicleId: id,
  driverId: id,
  truckStatus: truckLocationStatusSchema,
  inDateTime: isoDate,
  openingKm: z.coerce.number().int().min(0),
  remarks: z.string().trim().max(1000).optional(),
  partLines: z.array(jobCardPartLineInputSchema).default([]),
  serviceLines: z.array(jobCardServiceLineInputSchema).default([]),
});

export const updateJobCardSchema = createJobCardSchema.partial({
  branchId: true,
  vehicleId: true,
  driverId: true,
  truckStatus: true,
  inDateTime: true,
  openingKm: true,
});

export const finaliseJobCardSchema = z.object({
  outDateTime: isoDate,
  closingKm: z.coerce.number().int().min(0),
});

export const cancelJobCardSchema = z.object({
  reason: z.string().trim().min(1, "Cancellation reason is required").max(500),
});

export const undoFinaliseJobCardSchema = z.object({
  reason: z.string().trim().min(1, "A reason is required to undo a finalised job card").max(500),
});

export const jobCardListQuerySchema = z.object({
  branchId: id.optional(),
  vehicleId: id.optional(),
  status: jobCardStatusSchema.optional(),
  page: z.coerce.number().int().min(0).default(0),
  size: z.coerce.number().int().min(1).max(100).default(10),
});
