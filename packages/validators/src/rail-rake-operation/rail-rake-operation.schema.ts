import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || undefined);

const optionalDate = z.coerce.date().optional();
const optionalMoney = z.coerce.number().finite().min(0).optional();

export const railRakeOperationStageSchema = z.enum([
  "ORIGIN_RAILHEAD",
  "DESTINATION_BRANCH",
]);

export const railRakeChargePartySchema = z.enum([
  "COMPANY",
  "CUSTOMER",
  "RAILWAY",
  "TRANSPORTER",
  "OTHER",
]);

const placementSchema = z
  .object({
    sequence: z.coerce.number().int().min(1),
    placedAt: z.coerce.date(),
    removedAt: optionalDate,
    freeMinutes: z.coerce.number().int().min(0).default(0),
    remarks: optionalText(500),
  })
  .superRefine((value, ctx) => {
    if (value.removedAt && value.removedAt < value.placedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["removedAt"],
        message: "Removal time cannot be before placement time",
      });
    }
  });

const waiverSchema = z.object({
  enabled: z.boolean().default(false),
  status: z
    .enum(["REQUESTED", "APPROVED", "REJECTED", "RECEIVED", "CANCELLED"])
    .default("REQUESTED"),
  letterGivenAt: optionalDate,
  letterApprovedAt: optionalDate,
  letterReceivedAt: optionalDate,
  waiverPercentage: z.coerce.number().finite().min(0).max(100).optional(),
  requestedAmount: optionalMoney,
  approvedAmount: optionalMoney,
  referenceNumber: optionalText(100),
  remarks: optionalText(500),
});

const paymentSchema = z.object({
  enabled: z.boolean().default(false),
  kind: z.enum(["CHARGE_PAYMENT", "WAIVER_RECEIPT"]).default("CHARGE_PAYMENT"),
  status: z.enum(["PENDING", "CONFIRMED", "CANCELLED"]).default("PENDING"),
  amount: optionalMoney,
  paymentBy: railRakeChargePartySchema.default("COMPANY"),
  paymentMode: z.enum(["CASH", "BANK", "UPI", "CHEQUE"]).default("BANK"),
  paymentAt: optionalDate,
  referenceNumber: optionalText(100),
  remarks: optionalText(500),
});

const chargeSchema = z.object({
  type: z.enum(["DEMURRAGE", "WHARFAGE"]),
  ratePerHour: optionalMoney,
  manualAmount: optionalMoney,
  chargeLetterDate: optionalDate,
  paymentBy: railRakeChargePartySchema.optional(),
  remarks: optionalText(500),
  waiver: waiverSchema.optional(),
  payment: paymentSchema.optional(),
});

const operationFields = z
  .object({
    arrivalAt: optionalDate,
    departureAt: optionalDate,
    remarks: optionalText(1000),
    placements: z
      .array(placementSchema)
      .length(2, "The 1st and 2nd Rake timings are required"),
    charges: z
      .array(chargeSchema)
      .length(2, "Demurrage and Wharfage are required"),
  })
  .superRefine((value, ctx) => {
    if (
      value.departureAt &&
      value.arrivalAt &&
      value.departureAt < value.arrivalAt
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["departureAt"],
        message: "Departure time cannot be before arrival time",
      });
    }
    const sequences = value.placements.map((item) => item.sequence);
    if (new Set(sequences).size !== sequences.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["placements"],
        message: "Placement sequence must be unique",
      });
    }
    const types = value.charges.map((item) => item.type);
    if (new Set(types).size !== 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["charges"],
        message: "Include one Demurrage and one Wharfage charge",
      });
    }
    for (const [index, charge] of value.charges.entries()) {
      if (charge.type === "WHARFAGE" && charge.waiver?.enabled) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["charges", index, "waiver"],
          message: "Waiver is supported only for Demurrage",
        });
      }
      if (
        charge.type === "DEMURRAGE" &&
        charge.waiver?.enabled &&
        (charge.waiver.status === "APPROVED" ||
          charge.waiver.status === "RECEIVED") &&
        charge.waiver.approvedAmount === undefined &&
        charge.waiver.waiverPercentage === undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["charges", index, "waiver"],
          message: `${charge.type} approved waiver amount or percentage is required`,
        });
      }
      if (
        charge.payment?.enabled &&
        (charge.payment.amount === undefined || !charge.payment.paymentAt)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["charges", index, "payment"],
          message: "Payment amount and date are required",
        });
      }
    }
  });

export const calculateRailRakeOperationSchema = operationFields;

export const createRailRakeOperationSchema = operationFields.and(
  z.object({
    railRakeId: z.string().trim().min(1),
    stage: railRakeOperationStageSchema,
  }),
);

export const updateRailRakeOperationSchema = operationFields.and(
  z.object({
    version: z.coerce.number().int().min(1),
  }),
);

export const submitRailRakeOperationSchema = z.object({
  version: z.coerce.number().int().min(1),
});

export type CreateRailRakeOperationInput = z.infer<
  typeof createRailRakeOperationSchema
>;
export type UpdateRailRakeOperationInput = z.infer<
  typeof updateRailRakeOperationSchema
>;
export type CalculateRailRakeOperationInput = z.infer<
  typeof calculateRailRakeOperationSchema
>;
