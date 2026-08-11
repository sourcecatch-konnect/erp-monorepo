import { z } from "zod";



const requiredLabourCount = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.coerce
    .number()
    .int("Number of labour must be a whole number")
    .min(1, "Number of labour must be at least 1")
    .max(10, "Number of labour cannot exceed 10"),
);

const requiredLabourCharge = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.coerce.number().min(0, "Labour charge cannot be negative"),
);

const requiredUnloadingSupervisor = z
  .string()
  .trim()
  .min(1, "Unloading supervisor is required");

const createRailBranchGRNItemSchema = z.object({
  vpLoadingGoodsId: z.string().trim().min(1),

  receivedQty: z.coerce.number().int().min(0),
  damageQty: z.coerce.number().int().min(0),
  shortageQty: z.coerce.number().int().min(0),

  remarks: z.string().trim().max(500).optional(),
});

const updateRailBranchGRNItemSchema = z.object({
  id: z.string().trim().min(1),

  receivedQty: z.coerce.number().int().min(0),
  damageQty: z.coerce.number().int().min(0),
  shortageQty: z.coerce.number().int().min(0),

  remarks: z.string().trim().max(500).optional(),
});

export const submitRailBranchGRNSchema = z.object({
  version: z.number().int().min(1),
  damagePhotoAttachmentIds: z
    .array(z.string().trim().min(1))
    .optional()
    .default([]),
});
export const createRailBranchGRNSchema = z.object({
  railRakeId: z.string().trim().min(1),
  vpWagonLoadingId: z.string().trim().min(1),

  inDateTime: z.coerce.date().optional(),
  outDateTime: z.coerce.date().optional(),
  unloadingMinutes: z.coerce.number().int().min(0).optional(),

  damagesBy: z
    .enum(["NONE", "TRANSPORTER", "LABOUR", "RAILWAY", "CUSTOMER", "UNKNOWN"])
    .optional(),

  labourCount: requiredLabourCount,
  labourLeaderId: z.string().trim().optional(),
  labourCharge: requiredLabourCharge,
  unloadingSupervisorId: requiredUnloadingSupervisor,

  remarks: z.string().trim().max(500).optional(),

  items: z.array(createRailBranchGRNItemSchema).min(1),
  damagePhotoAttachmentIds: z
    .array(z.string().trim().min(1))
    .optional()
    .default([]),
});
export const updateRailBranchGRNSchema = z.object({
  version: z.coerce.number().int().min(0),

  inDateTime: z.coerce.date().optional(),
  outDateTime: z.coerce.date().optional(),
  unloadingMinutes: z.coerce.number().int().min(0).optional(),

  damagesBy: z
    .enum(["NONE", "TRANSPORTER", "LABOUR", "RAILWAY", "CUSTOMER", "UNKNOWN"])
    .optional(),

  labourCount: requiredLabourCount,
  labourLeaderId: z.string().trim().optional(),
  labourCharge: requiredLabourCharge,
  unloadingSupervisorId: requiredUnloadingSupervisor,

  remarks: z.string().trim().max(500).optional(),

  items: z.array(updateRailBranchGRNItemSchema).min(1),
  damagePhotoAttachmentIds: z
    .array(z.string().trim().min(1))
    .optional()
    .default([]),
});
export type CreateRailBranchGRNInput = z.infer<
  typeof createRailBranchGRNSchema
>;
export type UpdateRailBranchGRNInput = z.infer<
  typeof updateRailBranchGRNSchema
>;
export type SubmitRailBranchGRNInput = z.infer<
  typeof submitRailBranchGRNSchema
>;
