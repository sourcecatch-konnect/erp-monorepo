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

const dateString = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: `${label} is not valid`,
    });

const idString = (label: string) =>
  z.string().trim().min(1, `${label} is required`);

export const vpScheduleStatusSchema = z.enum([
  "DRAFT",
  "PLANNED",
  "CANCELLED",
]);

export const vpScheduleWagonCountSchema = z.object({
  id: z.string().optional(),

  wagonId: idString("Wagon"),

  count: z.coerce
    .number()
    .int("Wagon count must be a whole number")
    .min(1, "Wagon count must be at least 1"),
});

export const vpScheduleSchema = z.object({
  id: z.string(),

  scheduleNumber: z.string(),
  scheduleDate: z.string(),
  scheduleName: z.string(),

  fromBranchId: z.string(),
  toBranchId: z.string(),

  sourceAreaId: z.string(),
  destinationAreaId: z.string(),

  status: vpScheduleStatusSchema,

  totalWagonCount: z.number(),
  totalCapacityCft: z.number().nullable().optional(),
  totalCapacityMt: z.number().nullable().optional(),

  remarks: z.string().nullable().optional(),

  createdById: z.string(),
  updatedById: z.string().nullable().optional(),

  fromBranch: z
    .object({
      id: z.string(),
      branchCode: z.string().optional(),
      name: z.string().optional(),
    })
    .optional(),

  toBranch: z
    .object({
      id: z.string(),
      branchCode: z.string().optional(),
      name: z.string().optional(),
    })
    .optional(),

  sourceArea: z
  .object({
    id: z.string(),
    name: z.string(),
    city: z
      .object({
        id: z.string(),
        name: z.string(),
      })
      .nullable()
      .optional(),
  })
  .optional(),

destinationArea: z
  .object({
    id: z.string(),
    name: z.string(),
    city: z
      .object({
        id: z.string(),
        name: z.string(),
      })
      .nullable()
      .optional(),
  })
  .optional(),

  wagonCounts: z
    .array(
      z.object({
        id: z.string(),
        wagonId: z.string(),
        count: z.number(),
        freightMatrixId: z.string().nullable().optional(),
        freightAmount: z.union([z.number(), z.string()]).nullable().optional(),
        totalFreight: z.union([z.number(), z.string()]).nullable().optional(),
        capacityCft: z.number().nullable().optional(),
        capacityMt: z.number().nullable().optional(),
        totalCft: z.number().nullable().optional(),
        totalMt: z.number().nullable().optional(),
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
      }),
    )
    .optional(),

  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const vpScheduleBodySchema = z.object({
  scheduleDate: dateString("Schedule date"),

  scheduleName: z
    .string()
    .trim()
    .min(1, "Schedule name is required")
    .max(100, "Schedule name cannot exceed 100 characters"),

  fromBranchId: idString("From branch"),
  toBranchId: idString("To branch"),

  sourceAreaId: idString("Source area"),
  destinationAreaId: idString("Destination area"),

  remarks: optionalLimitedString(
    250,
    "Remarks cannot exceed 250 characters",
  ),

  wagonCounts: z
    .array(vpScheduleWagonCountSchema)
    .min(1, "At least one wagon is required"),
});

const validateVPScheduleBody = (
  data: {
    fromBranchId?: string;
    toBranchId?: string;
    sourceAreaId?: string;
    destinationAreaId?: string;
    wagonCounts?: { wagonId: string }[];
  },
  ctx: z.RefinementCtx,
) => {
  if (
    data.fromBranchId &&
    data.toBranchId &&
    data.fromBranchId === data.toBranchId
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["toBranchId"],
      message: "From branch and to branch cannot be same",
    });
  }

  if (
    data.sourceAreaId &&
    data.destinationAreaId &&
    data.sourceAreaId === data.destinationAreaId
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["destinationAreaId"],
      message: "Source area and destination area cannot be same",
    });
  }

  if (data.wagonCounts?.length) {
    const duplicateWagonIds = data.wagonCounts
      .map((item) => item.wagonId)
      .filter((wagonId, index, arr) => arr.indexOf(wagonId) !== index);

    if (duplicateWagonIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["wagonCounts"],
        message: "Same wagon cannot be added multiple times",
      });
    }
  }
};

export const createVPScheduleSchema = vpScheduleBodySchema.superRefine(
  validateVPScheduleBody,
);

export const updateVPScheduleSchema = vpScheduleBodySchema
  .partial()
  .superRefine(validateVPScheduleBody);

export const confirmVPScheduleSchema = z.object({
  remarks: optionalLimitedString(
    250,
    "Remarks cannot exceed 250 characters",
  ),
});

export const cancelVPScheduleSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Cancel reason is required")
    .max(250, "Cancel reason cannot exceed 250 characters"),
});
