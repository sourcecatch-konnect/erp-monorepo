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
      `${label} must be a positive whole number`,
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
  // Dispatch state at creation:
  //   alreadyDispatched = false -> trip is born Planned. `plannedStartDateTime`
  //     is an optional schedule/ETA (future allowed) and never changes status.
  //   alreadyDispatched = true  -> the truck already left. `startDateTime` is
  //     the real (back-dated) dispatch moment and the trip is born InTransit.
  alreadyDispatched: z.boolean().optional().default(false),
  startDateTime: optionalDate,
  plannedStartDateTime: optionalDate,
};

/**
 * Dispatch-state rules for trip creation. Kept separate from
 * `tripTypeRefinement` so the update schema (Planned edits only) is unaffected.
 */
const tripDispatchRefinement = (
  data: {
    alreadyDispatched?: boolean;
    startDateTime?: Date;
  },
  ctx: z.RefinementCtx,
) => {
  const now = Date.now();
  const notFuture = (value: Date | undefined, path: string, label: string) => {
    if (value && value.getTime() > now) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${label} can't be in the future`,
        path: [path],
      });
      return false;
    }
    return true;
  };

  if (data.alreadyDispatched) {
    if (!data.startDateTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Actual dispatch date and time is required when the truck has already left",
        path: ["startDateTime"],
      });
    } else {
      notFuture(data.startDateTime, "startDateTime", "Dispatch time");
    }
  } else if (data.startDateTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Remove the actual dispatch time, or tick 'Truck already dispatched'",
      path: ["startDateTime"],
    });
  }
};

// LR trips carry one client; DC trips are identified by their rake date.
const tripTypeRefinement = (
  data: { tripType: "lr" | "dc"; consignorId?: string; rakeDate?: Date },
  ctx: z.RefinementCtx,
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
  .superRefine(tripTypeRefinement)
  .superRefine(tripDispatchRefinement);

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

/**
 * Reschedule the expected dispatch time on a Planned trip. Empty clears it.
 * Any datetime allowed (a schedule, not an event).
 */
export const rescheduleTripSchema = z.object({
  plannedStartDateTime: optionalDate,
  version: z.number().int().positive().optional(),
});

const requiredDateField = (label: string) =>
  z
    .union([z.string(), z.date()])
    .transform((value) => new Date(value))
    .refine((value) => !Number.isNaN(value.getTime()), `Enter a valid ${label}`);

/** Limited, audited correction of operational fields on a Closed trip. */
export const correctClosedTripSchema = z.object({
  // Entered in rupees, stored as paise. Empty/return trips may legitimately be zero.
  onwardFreight: rupeesToPaise("Onward freight", { allowZero: true }),
  closingKm: positiveIntField("Closing KM"),
  startDateTime: requiredDateField("trip start date and time"),
  endDateTime: requiredDateField("trip closing date and time"),
  arrivalDateTime: optionalDate,
  unloadingCompletedAt: optionalDate,
  closeReason: optionalString,
  correctionReason: z
    .string()
    .trim()
    .min(3, "Please give a correction reason (min 3 characters)")
    .max(500, "Correction reason is too long"),
  version: z.number().int().positive().optional(),
});

/** Limited, audited correction of the start time on an InTransit trip. */
export const correctInTransitTripSchema = z.object({
  startDateTime: requiredDateField("trip start date and time"),
  correctionReason: z
    .string()
    .trim()
    .min(3, "Please give a correction reason (min 3 characters)")
    .max(500, "Correction reason is too long"),
  version: z.number().int().positive().optional(),
});

export const cancelTripSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Please give a reason (min 3 characters)")
    .max(500, "Reason is too long"),
});
