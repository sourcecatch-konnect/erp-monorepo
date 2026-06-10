import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const requiredDate = z
  .union([z.string(), z.date()])
  .refine((value) => !!value, "Pickup date is required")
  .transform((value) => new Date(value))
  .refine((value) => !Number.isNaN(value.getTime()), "Enter a valid date");

const positiveIntField = (label: string) =>
  z
    .union([z.string(), z.number()])
    .transform((value) => Number(value))
    .refine((value) => Number.isInteger(value) && value > 0, `${label} must be a positive whole number`);

const optionalNumberField = (label: string) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === "" || value === undefined || value === null) return undefined;
      return Number(value);
    })
    .refine((value) => value === undefined || !Number.isNaN(value), `${label} must be valid`);

const optionalEmail = z
  .string()
  .trim()
  .email("Enter a valid email")
  .optional()
  .or(z.literal("").transform(() => undefined));

export const orderTypeSchema = z.enum(["Truck", "Item"]);
export const orderStatusSchema = z.enum([
  "PendingApproval",
  "Confirmed",
  "Rejected",
  "Cancelled",
  "InProgress",
  "Completed",
]);

/* ------------------------------------------------------------------ */
/* Order item line                                                    */
/* ------------------------------------------------------------------ */

export const orderItemSchema = z.object({
  goodsId: z.string().min(1, "Select goods"),
  quantity: positiveIntField("Quantity"),
  unit: z.string().trim().min(1, "Unit is required").max(20, "Unit too long"),
  weight: optionalNumberField("Weight").refine(
    (value) => value === undefined || value >= 0,
    "Weight cannot be negative"
  ),
});

/* ------------------------------------------------------------------ */
/* Create / Update                                                    */
/* ------------------------------------------------------------------ */

const orderBaseShape = {
  customerId: z.string().min(1, "Customer is required"),
  fromBranchId: z.string().min(1, "From branch is required"),
  toBranchId: z.string().min(1, "To branch is required"),
  pickupDate: requiredDate,
  customerLocationId: optionalString,
  pickupAddressOverride: optionalString,
  specialInstructions: optionalString,
  orderType: orderTypeSchema,
  truckQuantity: optionalNumberField("Truck quantity"),
  vehicleTypeId: optionalString,
  contactPersonName: optionalString,
  contactMobile: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine(
      (value) => !value || /^(\+91)?[6-9]\d{9}$/.test(value),
      "Enter a valid Indian mobile number"
    )
    .transform((value) => (value ? value : undefined)),
  contactEmail: optionalEmail,
  items: z.array(orderItemSchema).optional(),
};

const typeRefinement = (
  data: { orderType: "Truck" | "Item"; truckQuantity?: number; vehicleTypeId?: string; items?: unknown[] },
  ctx: z.RefinementCtx
) => {
  if (data.orderType === "Truck") {
    if (!data.truckQuantity || data.truckQuantity < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Truck quantity is required for a truck order",
        path: ["truckQuantity"],
      });
    }
    if (!data.vehicleTypeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Vehicle type is required for a truck order",
        path: ["vehicleTypeId"],
      });
    }
  } else if (data.orderType === "Item") {
    if (!data.items || data.items.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add at least one item for an item order",
        path: ["items"],
      });
    }
  }
};

export const createOrderSchema = z.object(orderBaseShape).superRefine(typeRefinement);

export const updateOrderSchema = z.object(orderBaseShape).superRefine(typeRefinement);

/* ------------------------------------------------------------------ */
/* Transitions                                                        */
/* ------------------------------------------------------------------ */

export const approveOrderSchema = z.object({
  bookingFreightAmount: optionalNumberField("Freight amount").refine(
    (value) => value === undefined || value >= 0,
    "Freight cannot be negative"
  ),
  freightOverrideReason: optionalString,
  // Set true by the UI to confirm proceeding despite a disallow-new-booking flag.
  acknowledgeDisallow: z.boolean().optional(),
});

export const rejectOrderSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Please give a reason (min 3 characters)")
    .max(500, "Reason is too long"),
});

export const cancelOrderSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Please give a reason (min 3 characters)")
    .max(500, "Reason is too long"),
});
