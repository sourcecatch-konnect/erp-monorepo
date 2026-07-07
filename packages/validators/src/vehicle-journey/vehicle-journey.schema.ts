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

export const vehicleJourneyStatusSchema = z.enum([
  "DRAFT",
  "ACTIVE",
  "RETURNED",
  "READY_FOR_LOGSLIP",
  "SETTLED",
  "REOPENED",
  "CANCELLED",
]);

export const journeySettlementStatusSchema = z.enum([
  "NOT_READY",
  "PENDING_REVIEW",
  "READY",
  "GENERATED",
  "POSTED",
  "TALLY_SYNCED",
]);

export const tripLegTypeSchema = z.enum([
  "LR",
  "DC",
  "EMPTY",
  "LOCAL",
  "RETURN",
  "WORKSHOP",
  "OTHER",
]);

/* ------------------------------------------------------------------ */
/* Legs                                                               */
/* ------------------------------------------------------------------ */

const legBaseShape = {
  legType: tripLegTypeSchema,
  routeId: z.string().min(1, "Route is required"),
  // Required only for LR legs (full-load, single client) — see refinement.
  consignorId: optionalString,
  // Required only for DC (rake/rail) legs — see refinement.
  rakeDate: optionalDate,
  // Entered in rupees, stored as paise (empty/return legs carry ₹0 freight).
  onwardFreight: rupeesToPaise("Onward freight", { allowZero: true }),
  isTripEmpty: z.boolean().optional().default(false),
  openingKm: positiveIntField("Opening KM"),
  startDateTime: optionalDate,
  // Reason the operator broke city/KM/time continuity with the previous leg.
  // Required by the server whenever the chain check fails.
  chainExceptionReason: optionalString,
  remarks: optionalString,
};

const legTypeRefinement = (
  data: {
    legType: z.infer<typeof tripLegTypeSchema>;
    consignorId?: string;
    rakeDate?: Date;
  },
  ctx: z.RefinementCtx,
) => {
  if (data.legType === "LR" && !data.consignorId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Client is required for an LR leg",
      path: ["consignorId"],
    });
  }
  if (data.legType === "DC" && !data.rakeDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Rake date is required for a DC leg",
      path: ["rakeDate"],
    });
  }
};

export const addJourneyLegSchema = z
  .object(legBaseShape)
  .superRefine(legTypeRefinement);

export const closeJourneyLegSchema = z.object({
  closingKm: positiveIntField("Closing KM"),
  endDateTime: optionalDate,
  arrivalDateTime: optionalDate,
  unloadingCompletedAt: optionalDate,
  closeReason: optionalString,
});

export const dispatchJourneyLegSchema = z.object({
  startDateTime: optionalDate,
});

/* ------------------------------------------------------------------ */
/* Journey                                                            */
/* ------------------------------------------------------------------ */

export const startJourneySchema = z.object({
  vehicleId: z.string().min(1, "Vehicle is required"),
  driverId: z.string().min(1, "Driver is required"),
  homeBranchId: z.string().min(1, "Home branch is required"),
  startCityId: z.string().min(1, "Start city is required"),
  returnCityId: z.string().min(1, "Return city is required"),
  openingKm: positiveIntField("Opening KM"),
  startedAt: optionalDate,
  remarks: optionalString,
  firstLeg: z.object(legBaseShape).superRefine(legTypeRefinement),
});

export const cancelJourneySchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Please give a reason (min 3 characters)")
    .max(500, "Reason is too long"),
});

/**
 * Force-close a journey away from its configured return city (non-base
 * closure). Requires an explicit reason; the server additionally requires
 * the `vehicle_journey.override_chain` permission.
 */
export const closeJourneySchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Please give a reason (min 3 characters)")
    .max(500, "Reason is too long"),
});
