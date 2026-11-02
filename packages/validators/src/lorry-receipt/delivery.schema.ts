import { z } from "zod";
import { optionalRupeesToPaise } from "../_shared/money.js";

/**
 * Delivery + acknowledgement schemas (post-transit LR lifecycle).
 * Shared by the server routes (.parse) and the web dialogs (zodResolver).
 * See docs/LR_DELIVERY_ACK_PLAN.md.
 */

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const requiredDate = (label: string) =>
  z
    .union([z.string(), z.date()])
    .transform((value) => new Date(value))
    .refine(
      (value) => !Number.isNaN(value.getTime()),
      `Enter a valid ${label}`,
    );

const optionalDate = (label: string) =>
  z
    .union([z.string(), z.date()])
    .optional()
    .transform((value) => {
      if (value === "" || value === undefined || value === null) {
        return undefined;
      }
      return new Date(value);
    })
    .refine(
      (value) => value === undefined || !Number.isNaN(value.getTime()),
      `Enter a valid ${label}`,
    );

const optionalNonNegativeInt = (label: string) =>
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
      (value) => value === undefined || (Number.isInteger(value) && value >= 0),
      `${label} must be a non-negative whole number`,
    );

const optionalQty = (label: string) =>
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
      `${label} must be a non-negative number`,
    );

/* ------------------------------------------------------------------ */
/* Delivery                                                            */
/* ------------------------------------------------------------------ */

const deliveryFields = {
  deliveredAt: requiredDate("delivery date"),
  // Truck arrival at the consignee. Detention runs from the earliest of these
  // across a challan's LRs, so it is kept apart from the handover time.
  reportedAt: optionalDate("truck reporting time"),
  unloadingAt: optionalDate("unloading completion date"),
  receiverName: optionalString,
  receiverPhone: optionalString,
  unloadingCharges: optionalRupeesToPaise("Unloading charges", {
    allowZero: true,
  }),
  remark: optionalString,
};

/** Reported → delivered → unloaded, in that order. */
const checkDeliveryOrder = (
  value: { deliveredAt: Date; reportedAt?: Date; unloadingAt?: Date },
  ctx: z.RefinementCtx,
) => {
  if (value.reportedAt && value.reportedAt > value.deliveredAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reportedAt"],
      message: "Truck reporting time cannot be after the delivery time",
    });
  }
  if (value.unloadingAt && value.unloadingAt < value.deliveredAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["unloadingAt"],
      message: "Unloading completion cannot be before delivery time",
    });
  }
};

/**
 * The day the broker's truck reported at the station, per delivery challan the
 * LR travelled on. The office enters it with the delivery, when the papers
 * come back; `null` clears it. Single-LR delivery only — a bulk delivery
 * spans challans that are better set one LR at a time.
 */
const challanReportDates = z
  .array(
    z.object({
      challanId: z.string().min(1),
      version: z.coerce.number().int().min(1),
      reportDate: z.coerce.date().nullable(),
    }),
  )
  .optional();

export const deliverLRSchema = z
  .object({ ...deliveryFields, challanReportDates })
  .superRefine(checkDeliveryOrder);

export type DeliverLRInput = z.infer<typeof deliverLRSchema>;

export const updateLRDeliverySchema = z.object({
  ...deliveryFields,
  deliveredAt: optionalDate("delivery date"),
  challanReportDates,
});

export type UpdateLRDeliveryInput = z.infer<typeof updateLRDeliverySchema>;

/** Bulk deliver a whole group: shared fields + one row per LR. */
export const deliverGroupSchema = z
  .object({
    ...deliveryFields,
    lrs: z
      .array(
        z.object({
          lrId: z.string().min(1),
          unloadingCharges: optionalRupeesToPaise("Unloading charges", {
            allowZero: true,
          }),
          remark: optionalString,
        }),
      )
      .min(1, "Select at least one lorry receipt"),
  })
  .superRefine(checkDeliveryOrder);
export type DeliverGroupInput = z.infer<typeof deliverGroupSchema>;

/* ------------------------------------------------------------------ */
/* Acknowledgement (POD return)                                        */
/* ------------------------------------------------------------------ */

export const ackItemSchema = z.object({
  lrGoodsId: z.string().min(1),
  receivedQty: optionalQty("Received quantity"),
  damagedQty: optionalQty("Damaged quantity"),
});

export type AckItemInput = z.infer<typeof ackItemSchema>;

const acknowledgementFields = {
  receivedAt: requiredDate("received date"),
  courierName: optionalString,
  courierDocketNo: optionalString,
  courierCharge: optionalRupeesToPaise("Courier charge", { allowZero: true }),
  detentionDays: optionalNonNegativeInt("Detention days"),
  detentionAmount: optionalRupeesToPaise("Detention amount", {
    allowZero: true,
  }),
  damageAmount: optionalRupeesToPaise("Damage amount", { allowZero: true }),
  remark: optionalString,
  items: z.array(ackItemSchema).optional(),
};

export const acknowledgeLRSchema = z.object(acknowledgementFields);

export type AcknowledgeLRInput = z.infer<typeof acknowledgeLRSchema>;

export const updateLRAcknowledgementSchema = z.object({
  ...acknowledgementFields,
  receivedAt: optionalDate("received date"),
});

export type UpdateLRAcknowledgementInput = z.infer<
  typeof updateLRAcknowledgementSchema
>;

/* ------------------------------------------------------------------ */
/* Hub hold (leg-1 unload at Jalgaon)                                  */
/* ------------------------------------------------------------------ */

export const holdGroupAtHubSchema = z.object({
  hubArrivalAt: optionalDate("hub arrival date"),
});

export type HoldGroupAtHubInput = z.infer<typeof holdGroupAtHubSchema>;
