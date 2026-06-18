import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const requiredId = (label: string) => z.string().min(1, `${label} is required`);

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

const positiveInt = (label: string) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => Number(v))
    .refine((v) => Number.isInteger(v) && v > 0, `${label} must be a positive whole number`);

const optionalPositiveInt = (label: string) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === "" || v === undefined || v === null) return undefined;
      return Number(v);
    })
    .refine(
      (v) => v === undefined || (Number.isInteger(v) && v > 0),
      `${label} must be a positive whole number`,
    );

const requiredDate = z
  .union([z.string(), z.date()])
  .transform((v) => new Date(v))
  .refine((v) => !Number.isNaN(v.getTime()), "Enter a valid date");

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const lrStatusSchema = z.enum(["DRAFT", "FINALISED", "CANCELLED"]);
export const lrSourceSchema = z.enum(["FROM_ORDER", "INSTANT"]);
export const lrChargeTypeSchema = z.enum(["BASE_FREIGHT"]);
export const lrTransportTypeSchema = z.enum(["Road", "Rail", "RoadAndRail"]);
export const lrTripLegTypeSchema = z.enum(["DIRECT", "TO_HUB", "FROM_HUB"]);
export const lrPrioritySchema = z.enum(["Normal", "Express", "Critical"]);

/* ------------------------------------------------------------------ */
/* Goods line                                                          */
/* ------------------------------------------------------------------ */

export const lrGoodsLineSchema = z.object({
  name: z.string().trim().min(1, "Goods name is required").max(100),
  description: optionalString,
  quantity: positiveInt("Quantity"),
  unit: z.string().trim().min(1, "Unit is required").max(20),
  weight: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === "" || v === undefined || v === null) return undefined;
      return Number(v);
    })
    .refine((v) => v === undefined || (!Number.isNaN(v) && v >= 0), "Weight must be a valid number"),
  length: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === "" || v === undefined || v === null) return undefined;
      return Number(v);
    })
    .refine((v) => v === undefined || (!Number.isNaN(v) && v >= 0), "Length must be a valid number"),
  width: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === "" || v === undefined || v === null) return undefined;
      return Number(v);
    })
    .refine((v) => v === undefined || (!Number.isNaN(v) && v >= 0), "Width must be a valid number"),
  height: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === "" || v === undefined || v === null) return undefined;
      return Number(v);
    })
    .refine(
      (v) => v === undefined || (!Number.isNaN(v) && v >= 0),
      "Height must be a valid number",
    ),
});

export type LRGoodsLine = z.infer<typeof lrGoodsLineSchema>;

/* ------------------------------------------------------------------ */
/* Create from Order                                                   */
/* ------------------------------------------------------------------ */

export const createLRFromOrderSchema = z.object({
  source: z.literal("FROM_ORDER"),
  orderId: requiredId("Order"),
  consigneeId: requiredId("Consignee"),
  transportType: lrTransportTypeSchema.default("Road"),
  // Railhead branch (order + RoadAndRail only). Required is enforced in the
  // discriminated-union superRefine below. Unrelated to the Jalgaon hub.
  railheadBranchId: z.string().trim().optional().transform((v) => v || undefined),
  priority: lrPrioritySchema.default("Normal"),
  isMarketVehicle: z.boolean().default(false),
  // Order LRs can be explicitly marked as direct, going to hub, or departing
  // from hub at creation time.
  tripLegType: lrTripLegTypeSchema.default("DIRECT"),
  primaryTripId: z.string().trim().optional().transform((v) => v || undefined),
  marketVehicleNumber: z.string().trim().optional().transform((v) => v || undefined),
  marketDriverName: z.string().trim().optional().transform((v) => v || undefined),
  goods: z.array(lrGoodsLineSchema).min(1, "Add at least one goods line"),
});

export type CreateLRFromOrderInput = z.infer<typeof createLRFromOrderSchema>;

/* ------------------------------------------------------------------ */
/* Create Instant LR (road-only, no parent order)                      */
/* ------------------------------------------------------------------ */

export const createInstantLRSchema = z.object({
  source: z.literal("INSTANT"),
  isMarketVehicle: z.boolean().default(false),
  // Created direct: a single trip. The leg-2 trip is attached later by the HO
  // "split at hub" action, never at creation.
  primaryTripId: z.string().trim().optional().transform((v) => v || undefined),
  marketVehicleNumber: z.string().trim().optional().transform((v) => v || undefined),
  marketDriverName: z.string().trim().optional().transform((v) => v || undefined),
  consignorId: requiredId("Consignor"),
  consigneeId: requiredId("Consignee"),
  originBranchId: requiredId("Origin branch"),
  destinationBranchId: requiredId("Destination branch"),
  priority: lrPrioritySchema.default("Normal"),
  goods: z.array(lrGoodsLineSchema).min(1, "Add at least one goods line"),
});

export type CreateInstantLRInput = z.infer<typeof createInstantLRSchema>;

const _createLRUnion = z.discriminatedUnion("source", [
  createLRFromOrderSchema,
  createInstantLRSchema,
]);

export const createLRSchema = _createLRUnion.superRefine((d, ctx) => {
  if (d.source === "FROM_ORDER" && d.transportType === "RoadAndRail" && !d.railheadBranchId) {
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
  // Own-vehicle LRs must carry a trip — the trip is how the vehicle/driver and
  // expenses attach to the LR.
  if (!d.isMarketVehicle && !d.primaryTripId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Attach a trip for own-vehicle transport",
      path: ["primaryTripId"],
    });
  }
});

export type CreateLRInput = z.infer<typeof createLRSchema>;

/* ------------------------------------------------------------------ */
/* Update (DRAFT only — patch allowed fields)                          */
/* ------------------------------------------------------------------ */

export const updateLRSchema = z.object({
  isMarketVehicle: z.boolean().optional(),
  // Only the primary (leg-1) trip is editable here. Leg 2 / hub / tripLegType
  // are owned by the "split at hub" action, never the edit form.
  primaryTripId: z.string().trim().optional().transform((v) => v || undefined),
  marketVehicleNumber: z.string().trim().optional().transform((v) => v || undefined),
  marketDriverName: z.string().trim().optional().transform((v) => v || undefined),
  consigneeId: requiredId("Consignee").optional(),
  transportType: lrTransportTypeSchema.optional(),
  railheadBranchId: z.string().trim().optional().transform((v) => v || undefined),
  priority: lrPrioritySchema.optional(),
  invoiceNumber: optionalString,
  invoiceAmount: optionalPositiveInt("Invoice amount"),
  goods: z.array(lrGoodsLineSchema).min(1, "Add at least one goods line").optional(),
});

export type UpdateLRInput = z.infer<typeof updateLRSchema>;

/* ------------------------------------------------------------------ */
/* Split at hub (HO action on a FINALISED LR — attaches the leg-2 trip) */
/* ------------------------------------------------------------------ */

export const splitLRAtHubSchema = z.object({
  // The leg-2 trip (hub → final destination). Hub itself is derived server-side
  // from the head-office branch, never sent by the client.
  secondaryTripId: requiredId("Leg 2 trip"),
});

export type SplitLRAtHubInput = z.infer<typeof splitLRAtHubSchema>;

/* ------------------------------------------------------------------ */
/* Finalise                                                            */
/* ------------------------------------------------------------------ */

export const finaliseLRSchema = z.object({
  sealNumber: z.string().trim().optional().transform((v) => v || undefined),
  invoiceNumber: optionalString,
  invoiceAmount: optionalPositiveInt("Invoice amount"),
  baseFreightAmount: z
    .union([z.string(), z.number()])
    .transform((v) => Number(v))
    .refine((v) => Number.isInteger(v) && v > 0, "Base freight amount must be a positive whole number (paisa)"),
  ewayBill: z.object({
    ewayBillNo: z.string().trim().min(1, "E-way bill number is required"),
    generatedAt: requiredDate,
    expiresAt: requiredDate,
    generatedBy: optionalString,
    documentUrl: optionalString,
  }),
});

export type FinaliseLRInput = z.infer<typeof finaliseLRSchema>;

/* ------------------------------------------------------------------ */
/* Cancel                                                              */
/* ------------------------------------------------------------------ */

export const cancelLRSchema = z.object({
  cancelReason: z
    .string()
    .trim()
    .min(3, "Please give a reason (min 3 characters)")
    .max(500, "Reason too long"),
});

export type CancelLRInput = z.infer<typeof cancelLRSchema>;

/* ------------------------------------------------------------------ */
/* Add e-way bill (standalone, for additional eway bills post-create)  */
/* ------------------------------------------------------------------ */

export const addEwayBillSchema = z.object({
  ewayBillNo: z.string().trim().min(1, "E-way bill number is required"),
  generatedAt: requiredDate,
  expiresAt: requiredDate,
  generatedBy: optionalString,
  documentUrl: optionalString,
});

export type AddEwayBillInput = z.infer<typeof addEwayBillSchema>;
