import { z } from "zod";
import { rupeesToPaise } from "../_shared/money.js";

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
    if (value === "" || value === undefined || value === null) return undefined;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  });

const positiveIntField = (label: string) =>
  z
    .union([z.string(), z.number()])
    .transform((value) => Number(value))
    .refine(
      (value) => Number.isInteger(value) && value > 0,
      `${label} must be a positive whole number`
    );

/* ------------------------------------------------------------------ */
/* Enums                                                              */
/* ------------------------------------------------------------------ */

export const tripTypeSchema = z.enum(["lr", "dc"]);
export const tripStatusSchema = z.enum([
  "Planned",
  "InTransit",
  "Closed",
  "Cancelled",
]);

/* ------------------------------------------------------------------ */
/* Create / Update                                                    */
/* ------------------------------------------------------------------ */

const tripBaseShape = {
  vehicleId: z.string().min(1, "Vehicle is required"),
  driverId: z.string().min(1, "Driver is required"),
  routeId: z.string().min(1, "Route is required"),
  tripType: tripTypeSchema,
  // Entered in rupees, stored as paise (empty trips may carry ₹0 freight).
  onwardFreight: rupeesToPaise("Onward freight", { allowZero: true }),
  // Opening odometer reading, captured when the trip is planned/created.
  openingKm: positiveIntField("Opening KM"),
  isTripEmpty: z.boolean().optional().default(false),
  // Required only for LR trips (full-load, single client) — see refinement.
  consignorId: optionalString,
  // Required only for DC (rake/rail) trips — see refinement below.
  rakeDate: optionalDate,
  // Every trip lives in a vehicle journey. When this trip breaks continuity
  // with the journey chain (from-city, opening KM, or a non-HO journey start)
  // the server requires this reason plus the chain-override permission.
  chainExceptionReason: optionalString,
};

// LR trips carry one client; DC trips are identified by their rake date.
const tripTypeRefinement = (
  data: { tripType: "lr" | "dc"; consignorId?: string; rakeDate?: Date },
  ctx: z.RefinementCtx
) => {
  if (data.tripType === "lr" && !data.consignorId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Client is required for an LR trip",
      path: ["consignorId"],
    });
  }
  if (data.tripType === "dc" && !data.rakeDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Rake date is required for a DC trip",
      path: ["rakeDate"],
    });
  }
};

export const createTripSchema = z
  .object(tripBaseShape)
  .superRefine(tripTypeRefinement);

export const updateTripSchema = z
  .object(tripBaseShape)
  .superRefine(tripTypeRefinement);

/* ------------------------------------------------------------------ */
/* Transitions                                                        */
/* ------------------------------------------------------------------ */

export const closeTripSchema = z.object({
  closingKm: positiveIntField("Closing KM"),
  endDateTime: optionalDate,
  arrivalDateTime: optionalDate,
  unloadingCompletedAt: optionalDate,
  closeReason: optionalString,
});

export const cancelTripSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Please give a reason (min 3 characters)")
    .max(500, "Reason is too long"),
});
