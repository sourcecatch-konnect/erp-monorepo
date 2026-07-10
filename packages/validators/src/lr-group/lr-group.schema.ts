import { z } from "zod";
import {
  lrTransportTypeSchema,
  lrTripLegTypeSchema,
  lrPrioritySchema,
  lrGoodsLineSchema,
  ewayBillSchema,
} from "../lorry-receipt/lorry-receipt.schema.js";
import { rupeesToPaise, optionalRupeesToPaise } from "../_shared/money.js";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const requiredId = (label: string) => z.string().min(1, `${label} is required`);

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

const optionalId = z
  .string()
  .trim()
  .optional()
  .transform((v) => v || undefined);

// Money fields (rupees → paise) come from the shared `_shared/money` boundary.
const positiveIntField = (label: string) =>
  z
    .union([z.string(), z.number()])
    .transform((value) => Number(value))
    .refine(
      (value) => Number.isInteger(value) && value > 0,
      `${label} must be a positive whole number`,
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

const goodsUnitValues = [
  "MT",
  "KG",
  "QUINTAL",
  "BAGS",
  "BOXES",
  "CARTONS",
  "BUNDLES",
  "PIECES",
  "DRUMS",
  "PALLETS",
  "ROLLS",
  "COILS",
] as const;

const totalWeightUnitSchema = z
  .string()
  .trim()
  .min(1, "Unit is required")
  .transform((value) => value.toUpperCase())
  .pipe(
    z.enum(goodsUnitValues, {
      errorMap: () => ({ message: "Select a valid unit" }),
    }),
  );
const truckIndexField = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === "" || v === undefined || v === null) return 1;
    return Number(v);
  })
  .refine(
    (v) => Number.isInteger(v) && v > 0,
    "Truck index must be a positive whole number",
  );

/* ------------------------------------------------------------------ */
/* Consignment line — only needed for INSTANT groups (no parent order).*/
/* FROM_ORDER groups read their lines from the order's OrderConsignment.*/
/* ------------------------------------------------------------------ */

const lrGroupGoodsLineSchema = z.object({
  name: z.string().trim().min(1, "Goods name is required"),
  description: optionalString,
  quantity: positiveIntField("Quantity"),

  // keep only if Instant LR still needs dimensions
  length: optionalNumberField("Length"),
  width: optionalNumberField("Width"),
  height: optionalNumberField("Height"),
});

export const lrGroupLineSchema = z.object({
  loadingLocationId: optionalId,
  unloadingLocationId: optionalId,

  totalWeight: optionalNumberField("Total weight").refine(
    (value) => value === undefined || value >= 0,
    "Total weight cannot be negative",
  ),

  totalWeightUnit: totalWeightUnitSchema.optional(),

  goods: z.array(lrGroupGoodsLineSchema).optional().default([]),
}).superRefine((line, ctx) => {
  if (line.totalWeight !== undefined && !line.totalWeightUnit) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Unit is required when total weight is provided",
      path: ["totalWeightUnit"],
    });
  }
});
export type LRGroupLineInput = z.infer<typeof lrGroupLineSchema>;

/* ------------------------------------------------------------------ */
/* Create — from an order (one truck of it)                            */
/* ------------------------------------------------------------------ */

const vehicleShape = {
  isMarketVehicle: z.boolean().default(false),

  // Own vehicle
  primaryTripId: optionalId,

  // Market vehicle
  marketVehicleNumber: optionalId,
  marketDriverName: optionalId,

  // Entered in rupees, stored as paise
  marketFreightAmount: optionalRupeesToPaise("Market freight amount"),
  marketAdvanceAmount: optionalRupeesToPaise("Market advance amount"),
  marketCommissionAmount: optionalRupeesToPaise("Market commission amount"),
  marketHamaliAmount: optionalRupeesToPaise("Market hamali amount"),
  marketTdsAmount: optionalRupeesToPaise("Market TDS amount"),
};

export const createGroupFromOrderSchema = z.object({
  source: z.literal("FROM_ORDER"),
  orderId: requiredId("Order"),
  truckIndex: truckIndexField,
  transportType: lrTransportTypeSchema.default("Road"),
  // Order groups can be marked direct, to-hub, or from-hub at creation.
  tripLegType: lrTripLegTypeSchema.default("DIRECT"),
  // Railhead branch (order + RoadAndRail only). Unrelated to the Jalgaon hub.
  railheadBranchId: optionalId,
  priority: lrPrioritySchema.default("Normal"),
  ...vehicleShape,
});

export type CreateGroupFromOrderInput = z.infer<
  typeof createGroupFromOrderSchema
>;

/* ------------------------------------------------------------------ */
/* Create — instant (road-only, no parent order)                       */
/* ------------------------------------------------------------------ */

export const createInstantGroupSchema = z.object({
  source: z.literal("INSTANT"),
  consignorId: requiredId("Consignor"),
  consigneeId: requiredId("Consignee"),
  originBranchId: requiredId("Origin branch"),
  destinationBranchId: requiredId("Destination branch"),
  transportType: lrTransportTypeSchema.default("Road"),
  priority: lrPrioritySchema.default("Normal"),
  ...vehicleShape,
  // Instant groups declare their consignments inline (no order to read from).
  lrs: z.array(lrGroupLineSchema).optional().default([]),
});

export type CreateInstantGroupInput = z.infer<typeof createInstantGroupSchema>;

const _createGroupUnion = z.discriminatedUnion("source", [
  createGroupFromOrderSchema,
  createInstantGroupSchema,
]);

export const createLRGroupSchema = _createGroupUnion.superRefine((d, ctx) => {
  if (
    d.source === "FROM_ORDER" &&
    d.transportType === "RoadAndRail" &&
    !d.railheadBranchId
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select a railhead branch for Road & Rail transport",
      path: ["railheadBranchId"],
    });
  }
  if (d.isMarketVehicle && !d.marketVehicleNumber) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Vehicle number is required for market vehicle",
      path: ["marketVehicleNumber"],
    });
  }
  // Own-vehicle groups must carry a trip — the trip is how the vehicle/driver
  // and expenses attach to the whole truckload.
  if (!d.isMarketVehicle && !d.primaryTripId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Attach a trip for own-vehicle transport",
      path: ["primaryTripId"],
    });
  }
 if (d.source === "INSTANT") {
  if (!d.lrs || d.lrs.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Add at least one consignment line",
      path: ["lrs"],
    });
  }

  (d.lrs ?? []).forEach((line, index) => {
    if (!line.loadingLocationId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Loading point is required",
        path: ["lrs", index, "loadingLocationId"],
      });
    }

    if (!line.unloadingLocationId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Unloading point is required",
        path: ["lrs", index, "unloadingLocationId"],
      });
    }

  });
}
});

export type CreateLRGroupInput = z.infer<typeof createLRGroupSchema>;

/* ------------------------------------------------------------------ */
/* Update (DRAFT group only — group-level fields)                      */
/* ------------------------------------------------------------------ */

export const updateLRGroupSchema = z.object({
  consigneeId: optionalId,
  transportType: lrTransportTypeSchema.optional(),
  railheadBranchId: optionalId,
  priority: lrPrioritySchema.optional(),

  isMarketVehicle: z.boolean().optional(),
  primaryTripId: optionalId,

  marketVehicleNumber: optionalId,
  marketDriverName: optionalId,

  // Entered in rupees, stored as paise
  marketFreightAmount: optionalRupeesToPaise("Market freight amount"),
  marketAdvanceAmount: optionalRupeesToPaise("Market advance amount"),
  marketCommissionAmount: optionalRupeesToPaise("Market commission amount"),
  marketHamaliAmount: optionalRupeesToPaise("Market hamali amount"),
  marketTdsAmount: optionalRupeesToPaise("Market TDS amount"),
});

export type UpdateLRGroupInput = z.infer<typeof updateLRGroupSchema>;

/* ------------------------------------------------------------------ */
/* Finalise — one atomic action over the whole group                   */
/*                                                                    */
/* The single base freight + seal are entered once for the truckload; */
/* each LR carries its own invoice + e-way bill. All LRs flip          */
/* DRAFT -> FINALISED together (all-or-nothing).                       */
/* ------------------------------------------------------------------ */

export const finaliseGroupLineSchema = z
  .object({
    lrId: requiredId("Lorry receipt"),
    invoiceNumber: optionalString,
    // Entered in rupees, stored as paise.
    invoiceAmount: optionalRupeesToPaise("Invoice amount"),
    existingEwayBillId: optionalId,
    ewayBill: ewayBillSchema.optional(),
  })
  .superRefine((line, ctx) => {
    const hasExisting = Boolean(line.existingEwayBillId);
    const hasNew = Boolean(line.ewayBill);

    if (hasExisting === hasNew) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ewayBill"],
        message: "Provide exactly one e-way bill for this LR",
      });
    }
  });

export const finaliseGroupSchema = z.object({
  baseFreightAmount: rupeesToPaise("Base freight amount"),
  sealNumber: optionalString,
  lrs: z.array(finaliseGroupLineSchema).min(1, "At least one LR is required"),
});

export type FinaliseGroupInput = z.infer<typeof finaliseGroupSchema>;

/* ------------------------------------------------------------------ */
/* Split at hub (HO action on a FINALISED group — attaches leg-2 trip) */
/* ------------------------------------------------------------------ */

export const splitGroupAtHubSchema = z.object({
  // The leg-2 trip (hub -> final destination). Hub itself is derived
  // server-side from the head-office branch, never sent by the client.
  secondaryTripId: requiredId("Leg 2 trip"),
});

export type SplitGroupAtHubInput = z.infer<typeof splitGroupAtHubSchema>;

/* ------------------------------------------------------------------ */
/* Cancel                                                              */
/* ------------------------------------------------------------------ */

export const cancelGroupSchema = z.object({
  cancelReason: z
    .string()
    .trim()
    .min(3, "Please give a reason (min 3 characters)")
    .max(500, "Reason too long"),
});

export type CancelGroupInput = z.infer<typeof cancelGroupSchema>;
