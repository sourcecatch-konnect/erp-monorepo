import { z } from "zod";

const optionalId = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || undefined);

const optionalMoney = z.coerce.number().finite().min(0).optional();

export const deliveryVehicleModeSchema = z.enum([
  "OWN",
  "MARKET",
]);

export const deliveryChallanStatusSchema = z.enum([
  "DRAFT",
  "ISSUED",
  "CANCELLED",
]);

const deliveryChallanItemSchema = z.object({
  branchGrnItemId: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1),
});

const dispatchFields = z.object({
  destinationAreaId: optionalId,
  destinationLocationId: z
    .string()
    .trim()
    .min(1, "Delivery destination is required"),
  deliveryAddress: optionalText(1000),

  vehicleMode: deliveryVehicleModeSchema,
  transportId: optionalId,
  vehicleId: z
    .string()
    .trim()
    .min(1, "Vehicle is required"),

  driverName: optionalText(150),
  driverMobile: optionalText(20),

  totalWeight: z.coerce.number().finite().positive().optional(),
  freightAmount: optionalMoney,
  advanceAmount: optionalMoney,
  paymentBy: optionalText(50),

  loadingAt: z.coerce.date(),
  supervisorId: z.string().trim().min(1, "Supervisor is required"),
  remarks: optionalText(1000),

  items: z.array(deliveryChallanItemSchema).min(1),
});

const withVehicleRules = <T extends z.infer<typeof dispatchFields>>(
  value: T,
  ctx: z.RefinementCtx,
) => {
  if (value.vehicleMode === "MARKET") {
    if (!value.transportId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["transportId"],
        message: "Transporter is required for a market vehicle",
      });
    }
    if (!value.vehicleId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["vehicleId"],
        message: "Vehicle is required for market delivery",
      });
    }
  }

  if (value.vehicleMode === "OWN" && !value.vehicleId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["vehicleId"],
      message: "Vehicle is required for own-vehicle delivery",
    });
  }

  if (
    value.advanceAmount !== undefined &&
    value.freightAmount !== undefined &&
    value.advanceAmount > value.freightAmount
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["advanceAmount"],
      message: "Advance cannot exceed freight amount",
    });
  }
};

export const createDeliveryChallanSchema = dispatchFields
  .extend({
    branchGrnId: z.string().trim().min(1),
  })
  .superRefine(withVehicleRules);

export const updateDeliveryChallanSchema = dispatchFields
  .extend({
    version: z.coerce.number().int().min(1),
  })
  .superRefine(withVehicleRules);

export const issueDeliveryChallanSchema = z.object({
  version: z.coerce.number().int().min(1),
});

export const cancelDeliveryChallanSchema = z.object({
  version: z.coerce.number().int().min(1),
  reason: z.string().trim().min(1).max(500),
});

export type CreateDeliveryChallanInput = z.infer<
  typeof createDeliveryChallanSchema
>;
export type UpdateDeliveryChallanInput = z.infer<
  typeof updateDeliveryChallanSchema
>;
export type IssueDeliveryChallanInput = z.infer<
  typeof issueDeliveryChallanSchema
>;
export type CancelDeliveryChallanInput = z.infer<
  typeof cancelDeliveryChallanSchema
>;
