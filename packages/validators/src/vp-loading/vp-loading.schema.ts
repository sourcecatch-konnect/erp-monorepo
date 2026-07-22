import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const idString = (label: string) =>
  z.string().trim().min(1, `${label} is required`);

const optionalNonNegativeNumber = (label: string) =>
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
      (value) => value === undefined || (!Number.isNaN(value) && value >= 0),
      `${label} cannot be negative`,
    );

const optionalVersion = z.coerce.number().int().min(1).optional();

export const vpLoadingMeasurementSourceSchema = z.enum([
  "UNKNOWN",
  "GOODS_MASTER_ESTIMATE",
  "LR_DECLARED",
  "GRN_DECLARED",
  "CUSTOMER_DECLARED",
  "INVOICE",
  "WEIGHBRIDGE",
  "MANUAL_OVERRIDE",
]);


export const vpLoadingGoodsInputSchema = z
  .object({
    grnGoodsId: idString("GRN goods"),

    loadedQty: z.coerce
      .number()
      .int("Loaded quantity must be a whole number")
      .min(0, "Loaded quantity cannot be negative"),

    loadingDamageQty: z.coerce
      .number()
      .int("Damage quantity must be a whole number")
      .min(0, "Damage quantity cannot be negative")
      .default(0),
  })
  .superRefine((data, ctx) => {
    if (
      data.loadingDamageQty >
      data.loadedQty
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Damage quantity cannot be greater than loaded quantity",
        path: ["loadingDamageQty"],
      });
    }
  });

export const createVPLoadingAllocationSchema = z
  .object({
    grnId: idString("GRN"),
    labourId: optionalString,
    labourCharge: optionalNonNegativeNumber("Labour charge"),
    loadingSupervisorId: optionalString,
    remarks: optionalString,
    wagonVersion: optionalVersion,
    goods: z
      .array(vpLoadingGoodsInputSchema)
      .min(1, "At least one goods row is required"),
  })
  .superRefine((data, ctx) => {
    if (!data.goods.some((row) => row.loadedQty > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one goods row must have loaded quantity",
        path: ["goods"],
      });
    }
  });

export const updateVPLoadingAllocationSchema = z
  .object({
    remarks: optionalString,
    version: optionalVersion,
    goods: z
      .array(vpLoadingGoodsInputSchema)
      .min(1, "At least one goods row is required"),
  })
  .superRefine((data, ctx) => {
    if (!data.goods.some((row) => row.loadedQty > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one goods row must have loaded quantity",
        path: ["goods"],
      });
    }
  });


export const cancelVPLoadingSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Please give a reason (min 3 characters)")
    .max(500, "Reason is too long"),
  version: optionalVersion,
});

export const completeVPWagonLoadingSchema = z.object({
  version: optionalVersion,
});

export const updateVPWagonLoadingLabourSchema = z.object({
  labourId: optionalString,
  labourCharge: optionalNonNegativeNumber("Labour charge"),
  loadingSupervisorId: optionalString,
  remarks: optionalString,
  version: optionalVersion,
});




export type VPLoadingGoodsInput = z.infer<typeof vpLoadingGoodsInputSchema>;
export type CreateVPLoadingAllocationInput = z.infer<
  typeof createVPLoadingAllocationSchema
>;
export type UpdateVPLoadingAllocationInput = z.infer<
  typeof updateVPLoadingAllocationSchema
>;
export type UpdateVPWagonLoadingLabourInput = z.infer<
  typeof updateVPWagonLoadingLabourSchema
>;
