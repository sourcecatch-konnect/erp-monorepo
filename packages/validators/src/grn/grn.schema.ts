import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));
const requiredIntRangeField = (
  label: string,
  minimum: number,
  maximum: number,
) =>
  z
    .union([z.string(), z.number()])
    .transform((value) => {
      if (value === "") return Number.NaN;
      return Number(value);
    })
    .refine(
      (value) =>
        Number.isInteger(value) &&
        value >= minimum &&
        value <= maximum,
      `${label} must be between ${minimum} and ${maximum}`,
    );
const optionalDate = z
  .union([z.string(), z.date()])
  .optional()
  .transform((value) => {
    if (!value) return undefined;
    return new Date(value);
  })
  .refine(
    (value) => value === undefined || !Number.isNaN(value.getTime()),
    "Enter a valid date",
  );

const optionalNumberField = (label: string) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === "" || value === undefined || value === null) {
        return undefined;
      }

      return Number(value);
    })
    .refine(
      (value) => value === undefined || !Number.isNaN(value),
      `${label} must be valid`,
    );

const optionalNonNegativeNumberField = (label: string) =>
  optionalNumberField(label).refine(
    (value) => value === undefined || value >= 0,
    `${label} cannot be negative`,
  );

const nonNegativeIntField = (label: string) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === "" || value === undefined || value === null) {
        return 0;
      }

      return Number(value);
    })
    .refine(
      (value) => Number.isInteger(value) && value >= 0,
      `${label} must be a non-negative whole number`,
    );

export const grnStatusSchema = z.enum(["DRAFT", "SUBMITTED", "CANCELLED"]);

export const grnDamagesBySchema = z.enum([
  "NONE",
  "TRANSPORTER",
  "LABOUR",
  "RAILWAY",
  "CUSTOMER",
  "UNKNOWN",
]);

export const grnGoodsSchema = z
  .object({
    lrGoodsId: optionalString,
    goodsName: z.string().trim().min(1, "Goods name is required"),
    description: optionalString,
    totalQty: nonNegativeIntField("Total quantity"),
    receivedQty: nonNegativeIntField("Received quantity"),
    damageQty: nonNegativeIntField("Damage quantity"),
    shortageQty: nonNegativeIntField("Shortage quantity"),
    quantityUnitId: optionalString,
    weightUnitId: optionalString,
    unit: optionalString,
    weight: optionalNonNegativeNumberField("Weight"),
    remarks: optionalString,
  })
  .superRefine((data, ctx) => {
    if (data.receivedQty + data.shortageQty > data.totalQty) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Received and shortage quantity cannot exceed total quantity",
        path: ["receivedQty"],
      });
    }

    if (data.damageQty > data.receivedQty) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Damage quantity cannot be greater than received quantity",
        path: ["damageQty"],
      });
    }
  });

const grnBaseShape = {
  lorryReceiptId: z.string().trim().min(1, "LR is required"),
  gateNo: z.enum(["1", "2", "3", "4", "5"], {
    message: "Please select gate number",
  }),

  labourCount: requiredIntRangeField(
    "Number of labour",
    1,
    10,
  ),

  inDateTime: optionalDate,
  outDateTime: optionalDate,
  unloadingMinutes: optionalNumberField("Unloading minutes"),

  totalWeightMt: optionalNonNegativeNumberField("Total weight"),

  totalFreight: optionalNonNegativeNumberField("Total freight"),
  balanceFreight: optionalNonNegativeNumberField("Balance freight"),
  freightPerMt: optionalNonNegativeNumberField("Freight per MT"),

  detentionDays: nonNegativeIntField("Detention days"),
  detentionRate: optionalNonNegativeNumberField("Detention rate"),

  advanceAmount: optionalNonNegativeNumberField("Advance"),
  damageAmount: optionalNonNegativeNumberField("Damage amount"),
  tdsAmount: optionalNonNegativeNumberField("TDS"),
  hamaliAmount: optionalNonNegativeNumberField("Hamali"),
  printingStationaryAmount: optionalNonNegativeNumberField(
    "Printing and stationery",
  ),
  labourName: optionalString,
  labourId: optionalString,
  labourCharge: optionalNonNegativeNumberField("Labour charge"),
  unloadingSupervisorId: optionalString,
  damagesBy: grnDamagesBySchema.optional(),

  lrCopyChecked: z.coerce.boolean().optional().default(false),
  invoiceChecked: z.coerce.boolean().optional().default(false),
  kataReceiptChecked: z.coerce.boolean().optional().default(false),
  wayBillChecked: z.coerce.boolean().optional().default(false),
  sealNoChecked: z.coerce.boolean().optional().default(false),

  lrCopyRemark: optionalString,
  invoiceRemark: optionalString,
  kataReceiptRemark: optionalString,
  wayBillRemark: optionalString,
  sealNoRemark: optionalString,

  remarks: optionalString,

  goods: z.array(grnGoodsSchema).min(1, "At least one goods line is required"),
  damagePhotoAttachmentIds: z.array(z.string().trim().min(1)).optional().default([]),

  version: z.number().optional(),
};

const grnDateRefinement = (
  data: {
    inDateTime?: Date;
    outDateTime?: Date;
    goods?: Array<{ damageQty: number }>;
    damagesBy?: z.infer<typeof grnDamagesBySchema>;
  },
  ctx: z.RefinementCtx,
) => {
  if (data.inDateTime && data.outDateTime && data.outDateTime < data.inDateTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Out time cannot be before in time",
      path: ["outDateTime"],
    });
  }

  const damageQty = (data.goods ?? []).reduce(
    (sum, row) => sum + row.damageQty,
    0,
  );

  if (damageQty > 0 && !data.damagesBy) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Damages by is required when damage quantity is entered",
      path: ["damagesBy"],
    });
  }
};

export const createGRNSchema = z
  .object(grnBaseShape)
  .superRefine(grnDateRefinement);

export const updateGRNSchema = z
  .object(grnBaseShape)
  .superRefine(grnDateRefinement);

export const submitGRNSchema = z.object({
  damagePhotoAttachmentIds: z.array(z.string().trim().min(1)).optional().default([]),
  version: z.number().optional(),
});

export const cancelGRNSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Please give a reason (min 3 characters)")
    .max(500, "Reason is too long"),
  version: z.number().optional(),
});

export type GRNGoodsInput = z.infer<typeof grnGoodsSchema>;
export type CreateGRNInput = z.infer<typeof createGRNSchema>;
export type UpdateGRNInput = z.infer<typeof updateGRNSchema>;
export type SubmitGRNInput = z.infer<typeof submitGRNSchema>;
export type CancelGRNInput = z.infer<typeof cancelGRNSchema>;
