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

export const vpLoadingStatusSchema = z.enum([
  "DRAFT",
  "LOADED",
  "CANCELLED",
]);

/* ------------------------------------------------------------------ */
/* Create / Update                                                    */
/* ------------------------------------------------------------------ */

const vpLoadingBaseShape = {
  vpScheduleId: z.string().trim().min(1, "VP Schedule is required"),
  mrRrId: z.string().trim().min(1, "MR/RR is required"),
  mrRrRowId: z.string().trim().min(1, "MR/RR row is required"),
  lorryReceiptId: z.string().trim().min(1, "LR is required"),
  grnId: z.string().trim().min(1, "GRN is required"),

  gateNo: optionalString,

  loadedQty: nonNegativeIntField("Loaded quantity"),
  loadedCft: optionalNonNegativeNumberField("Loaded CFT"),
  loadedWeightMt: optionalNonNegativeNumberField("Loaded weight"),

  labourId: optionalString,
  labourCharge: optionalNonNegativeNumberField("Labour charge"),

  loadingSupervisorId: optionalString,

  loadingStartedAt: optionalDate,
  loadingCompletedAt: optionalDate,

  remarks: optionalString,

  version: z.number().optional(),
};

const vpLoadingDateRefinement = (
  data: {
    loadingStartedAt?: Date;
    loadingCompletedAt?: Date;
  },
  ctx: z.RefinementCtx,
) => {
  if (
    data.loadingStartedAt &&
    data.loadingCompletedAt &&
    data.loadingCompletedAt < data.loadingStartedAt
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Loading completed time cannot be before loading started time",
      path: ["loadingCompletedAt"],
    });
  }
};

export const createVPLoadingSchema = z
  .object(vpLoadingBaseShape)
  .superRefine(vpLoadingDateRefinement);

export const updateVPLoadingSchema = z
  .object(vpLoadingBaseShape)
  .superRefine(vpLoadingDateRefinement);

/* ------------------------------------------------------------------ */
/* Transitions                                                        */
/* ------------------------------------------------------------------ */

export const markVPLoadedSchema = z.object({
  version: z.number().optional(),
});

export const cancelVPLoadingSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Please give a reason (min 3 characters)")
    .max(500, "Reason is too long"),

  version: z.number().optional(),
});