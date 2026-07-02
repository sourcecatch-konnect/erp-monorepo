import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

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

/* ------------------------------------------------------------------ */
/* Enums                                                              */
/* ------------------------------------------------------------------ */

export const grnStatusSchema = z.enum(["DRAFT", "SUBMITTED", "CANCELLED"]);

export const grnDamagesBySchema = z.enum([
  "NONE",
  "TRANSPORTER",
  "LABOUR",
  "RAILWAY",
  "CUSTOMER",
  "UNKNOWN",
]);

/* ------------------------------------------------------------------ */
/* GRN Goods                                                          */
/* ------------------------------------------------------------------ */

export const grnGoodsSchema = z
  .object({
    lrGoodsId: optionalString,

    goodsName: z
      .string()
      .trim()
      .min(1, "Goods name is required")
      .max(150, "Goods name is too long"),

    description: optionalString,

    totalQty: nonNegativeIntField("Total quantity"),
    receivedQty: nonNegativeIntField("Received quantity"),
    damageQty: nonNegativeIntField("Damage quantity"),
    shortageQty: nonNegativeIntField("Shortage quantity"),

    unit: optionalString,

    weight: optionalNonNegativeNumberField("Weight"),

    remarks: optionalString,
  })
  .superRefine((data, ctx) => {
    const actualQty = data.receivedQty + data.damageQty + data.shortageQty;

    if (actualQty > data.totalQty) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Received + damage + shortage quantity cannot be greater than total quantity",
        path: ["receivedQty"],
      });
    }
  });

/* ------------------------------------------------------------------ */
/* Create / Update                                                    */
/* ------------------------------------------------------------------ */

const grnBaseShape = {
  lorryReceiptId: z.string().trim().min(1, "LR is required"),

  gateNo: optionalString,

  inDateTime: optionalDate,
  outDateTime: optionalDate,

  labourId: optionalString,
  labourCharge: optionalNonNegativeNumberField("Labour charge"),

  unloadingSupervisorId: optionalString,

  damagesBy: grnDamagesBySchema.optional().default("NONE"),

  lrCopyChecked: z.boolean().optional().default(false),
  invoiceChecked: z.boolean().optional().default(false),
  kataReceiptChecked: z.boolean().optional().default(false),
  wayBillChecked: z.boolean().optional().default(false),
  sealNoChecked: z.boolean().optional().default(false),

  lrCopyRemark: optionalString,
  invoiceRemark: optionalString,
  kataReceiptRemark: optionalString,
  wayBillRemark: optionalString,
  sealNoRemark: optionalString,

  totalFreight: optionalNonNegativeNumberField("Total freight"),
  balanceFreight: optionalNonNegativeNumberField("Balance freight"),
  freightPerMt: optionalNonNegativeNumberField("Freight per MT"),

  detentionDays: nonNegativeIntField("Detention days"),
  detentionRate: optionalNonNegativeNumberField("Detention rate"),

  advanceAmount: optionalNonNegativeNumberField("Advance amount"),
  damageAmount: optionalNonNegativeNumberField("Damage amount"),
  tdsAmount: optionalNonNegativeNumberField("TDS amount"),
  hamaliAmount: optionalNonNegativeNumberField("Hamali amount"),
  printingStationaryAmount: optionalNonNegativeNumberField(
    "Printing stationary amount",
  ),

  remarks: optionalString,

  goods: z.array(grnGoodsSchema).min(1, "Add at least one goods line"),

  version: z.number().optional(),
};

const grnDateRefinement = (
  data: {
    inDateTime?: Date;
    outDateTime?: Date;
  },
  ctx: z.RefinementCtx,
) => {
  if (data.inDateTime && data.outDateTime && data.outDateTime < data.inDateTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Out date/time cannot be before in date/time",
      path: ["outDateTime"],
    });
  }
};

export const createGRNSchema = z.object(grnBaseShape).superRefine(grnDateRefinement);

export const updateGRNSchema = z.object(grnBaseShape).superRefine(grnDateRefinement);

/* ------------------------------------------------------------------ */
/* Transitions                                                        */
/* ------------------------------------------------------------------ */

export const submitGRNSchema = z.object({
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