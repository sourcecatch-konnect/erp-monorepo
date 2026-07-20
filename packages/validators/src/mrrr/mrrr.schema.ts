import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const optionalLimitedString = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((value) => (value ? value : undefined));

const idString = (label: string) =>
  z.string().trim().min(1, `${label} is required`);

export const mrrrStatusSchema = z.enum([
  "DRAFT",
  "SUBMITTED",
  "CANCELLED",
]);

export const rakeTypeSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.enum(["INDENT", "LEASE"]).optional(),
);
export const rakeTypeEnumSchema = z.enum(["INDENT", "LEASE"]);

export const rakeTypeFormSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  rakeTypeEnumSchema.optional(),
);
export const mrrrRowSchema = z.object({
  id: z.string(),

  mrRrId: z.string(),

  vpScheduleWagonCountId: z.string(),
  wagonId: z.string(),

  wagonTypeLabel: z.string(),
  rowNumber: z.number(),
  rowLabel: z.string(),

  sequenceNo: z.string().nullable().optional(),
  vpNo: z.string().nullable().optional(),
  mrRrNo: z.string().nullable().optional(),
  sealNo: z.string().nullable().optional(),

  wagon: z
    .object({
      id: z.string(),
      name: z.string(),
      height: z.number().nullable().optional(),
      width: z.number().nullable().optional(),
      weight: z.number().nullable().optional(),
      totalCft: z.number().nullable().optional(),
      capacityMt: z.number().nullable().optional(),
      isActive: z.boolean().optional(),
    })
    .optional(),

  vpWagonLoading: z
    .object({
      id: z.string(),
      status: z.string(),
      totalLoadedQty: z.number(),
      totalLoadedCft: z.union([z.number(), z.string()]).nullable().optional(),
      totalLoadedWeightMt: z
        .union([z.number(), z.string()])
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),

  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const mrrrSchema = z.object({
  id: z.string(),

  mrRrNumber: z.string().nullable().optional(),

  vpScheduleId: z.string(),
  rakeType: rakeTypeEnumSchema.nullable().optional(),
  status: mrrrStatusSchema,

  remarks: z.string().nullable().optional(),

  createdById: z.string(),
  updatedById: z.string().nullable().optional(),

  version: z.number().optional(),

  vpSchedule: z
    .object({
      id: z.string(),
      scheduleNumber: z.string(),
      scheduleDate: z.string(),
      scheduleName: z.string(),
      status: z.string().optional(),
      totalWagonCount: z.number().optional(),

      fromBranch: z
        .object({
          id: z.string(),
          name: z.string().optional(),
          branchCode: z.string().optional(),
        })
        .optional(),

      toBranch: z
        .object({
          id: z.string(),
          name: z.string().optional(),
          branchCode: z.string().optional(),
        })
        .optional(),
    })
    .optional(),

  rows: z.array(mrrrRowSchema).optional(),

  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const createMRRRSchema = z.object({
  vpScheduleId: idString("VP Schedule"),

  rakeType: rakeTypeFormSchema,

  remarks: optionalLimitedString(
    250,
    "Remarks cannot exceed 250 characters",
  ),

  rows: z
    .array(
      z.object({
        rowNumber: z.coerce.number().int().min(1),

        sequenceNo: optionalString,
        vpNo: optionalString,
        mrRrNo: optionalString,
        sealNo: optionalString,
      }),
    )
    .optional(),
});

export const updateMRRRSchema = z.object({
  rakeType: rakeTypeFormSchema,

  remarks: optionalLimitedString(
    250,
    "Remarks cannot exceed 250 characters",
  ),
});

export const updateMRRRRowsSchema = z.object({
  rows: z
    .array(
      z.object({
        id: idString("MR/RR row"),

        sequenceNo: optionalString,
        vpNo: optionalString,
        mrRrNo: optionalString,
        sealNo: optionalString,
      }),
    )
    .min(1, "At least one row is required"),
});

export const submitMRRRSchema = z.object({
  remarks: optionalLimitedString(
    250,
    "Remarks cannot exceed 250 characters",
  ),
});

export const cancelMRRRSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Cancel reason is required")
    .max(250, "Cancel reason cannot exceed 250 characters"),
});
