import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */
export const goodsUnitValues = [
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

export const goodsUnitSchema = z
  .string()
  .trim()
  .min(1, "Unit is required")
  .transform((value) => value.toUpperCase())
  .pipe(
    z.enum(goodsUnitValues, {
      errorMap: () => ({ message: "Select a valid unit" }),
    }),
  );
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
    .refine(
      (value) => Number.isInteger(value) && value > 0,
      `${label} must be a positive whole number`,
    );

const optionalNumberField = (label: string) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === "" || value === undefined || value === null)
        return undefined;
      return Number(value);
    })
    .refine(
      (value) => value === undefined || !Number.isNaN(value),
      `${label} must be valid`,
    );

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
  "LRCreated",
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

});
export const orderConsignmentGoodsSchema = z.object({
  goodsId: z.string().min(1, "Select goods"),
  quantity: positiveIntField("Quantity"),
});
/* ------------------------------------------------------------------ */
/* Consignment line (Truck orders, multi-loading-point)               */
/*                                                                    */
/* One line -> one LR at generation. Loading/unloading points are     */
/* CustomerLocations and may repeat across lines (N loads -> 1 drop,  */
/* or 1 load -> M drops). Lines sharing a truckIndex become one       */
/* LRGroup. Consignor/consignee are order-level, not on the line.     */
/* ------------------------------------------------------------------ */

export const orderConsignmentSchema = z.object({
  truckIndex: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === "" || v === undefined || v === null) return 1;
      return Number(v);
    })
    .refine(
      (v) => Number.isInteger(v) && v > 0,
      "Truck index must be a positive whole number",
    ),

  loadingLocationId: optionalString,
  unloadingLocationId: optionalString,

  totalWeight: optionalNumberField("Total weight").refine(
    (value) => value === undefined || value >= 0,
    "Total weight cannot be negative",
  ),

  totalWeightUnit: goodsUnitSchema,

  goods: z.array(orderConsignmentGoodsSchema).optional().default([]),
});
export type OrderConsignmentInput = z.infer<typeof orderConsignmentSchema>;

/* ------------------------------------------------------------------ */
/* Create / Update                                                    */
/* ------------------------------------------------------------------ */

const orderBaseShape = {
  customerId: z.string().min(1, "Customer is required"),
  // Consignee (receiver). Constant for the order; mirrors consignor on every
  // LRGroup generated from this order. Optional at draft, firmed before LRs.
  consigneeId: optionalString,
  fromBranchId: z.string().min(1, "From branch is required"),
  toBranchId: z.string().min(1, "To branch is required"),
  pickupDate: requiredDate,
  routeId: z.string().trim().min(1, "Route is required"),
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
      "Enter a valid Indian mobile number",
    )
    .transform((value) => (value ? value : undefined)),
  contactEmail: optionalEmail,
  // Item orders carry `items`; Truck multi-loading orders carry `consignments`.
  items: z.array(orderItemSchema).optional(),
  consignments: z.array(orderConsignmentSchema).optional(),
};

const typeRefinement = (
  data: {
    orderType: "Truck" | "Item";
    truckQuantity?: number;
    vehicleTypeId?: string;
    items?: unknown[];
    consignments?: OrderConsignmentInput[];
  },
  ctx: z.RefinementCtx,
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
    if (!data.consignments || data.consignments.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add at least one consignment line",
        path: ["consignments"],
      });
    }
    if (data.truckQuantity && data.consignments) {
      const assignedTrucks = new Set(
        data.consignments.map((line) => line.truckIndex),
      );
      const missingTrucks = Array.from(
        { length: data.truckQuantity },
        (_, index) => index + 1,
      ).filter((truckIndex) => !assignedTrucks.has(truckIndex));

      if (missingTrucks.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Add at least one LR/consignment line for truck${missingTrucks.length === 1 ? "" : "s"} ${missingTrucks.join(", ")}`,
          path: ["consignments"],
        });
      }
    }
    // A loading -> unloading pair must not repeat within the same truck: put
    // multiple goods on a single line instead of cloning the line. Different
    // trucks may share a lane (e.g. two trucks booked for A -> B), so the key
    // is scoped by truckIndex. Incomplete lines (missing either point) are
    // skipped — they fail their own required checks elsewhere.
    const seen = new Map<string, number>();
    (data.consignments ?? []).forEach((c, index) => {
      // A line can't be assigned to a truck beyond the booked quantity. This is
      // the source-of-truth guard: it keeps every consignment's truckIndex within
      // 1..truckQuantity so LR generation never finds an orphaned/empty truck.
      if (data.truckQuantity && c.truckIndex > data.truckQuantity) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Truck #${c.truckIndex} exceeds the booked truck quantity (${data.truckQuantity})`,
          path: ["consignments", index, "truckIndex"],
        });
      }
      if (!c.loadingLocationId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Loading point is required",
          path: ["consignments", index, "loadingLocationId"],
        });
      }
      if (!c.unloadingLocationId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Unloading point is required",
          path: ["consignments", index, "unloadingLocationId"],
        });
      }
      if (!c.loadingLocationId || !c.unloadingLocationId) return;
      const key = `${c.truckIndex}|${c.loadingLocationId}|${c.unloadingLocationId}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "This loading and unloading point pair already exists for this truck — add the goods to that line instead",
          path: ["consignments", index, "unloadingLocationId"],
        });
      } else {
        seen.set(key, index);
      }
    });
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

export const createOrderSchema = z
  .object(orderBaseShape)
  .superRefine(typeRefinement);

export const updateOrderSchema = z
  .object(orderBaseShape)
  .superRefine(typeRefinement);

/* ------------------------------------------------------------------ */
/* Transitions                                                        */
/* ------------------------------------------------------------------ */

export const approveOrderSchema = z.object({
  bookingFreightAmount: optionalNumberField("Freight amount").refine(
    (value) => value === undefined || value >= 0,
    "Freight cannot be negative",
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
