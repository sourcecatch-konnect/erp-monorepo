import { z } from "zod";

const id = z.string().trim().min(1);
const isoDate = z.coerce.date();
const positivePaise = z.coerce.bigint().positive();

export const repairInspectionSchema = z
  .object({
    brakes: z.enum(["PASS", "ATTENTION", "NA"]),
    steering: z.enum(["PASS", "ATTENTION", "NA"]),
    tyres: z.enum(["PASS", "ATTENTION", "NA"]),
    lights: z.enum(["PASS", "ATTENTION", "NA"]),
    leaks: z.enum(["PASS", "ATTENTION", "NA"]),
    reference: z.string().trim().min(1).max(200),
    notes: z.string().trim().max(2000).default(""),
  })
  .refine(
    (value) =>
      ![
        value.brakes,
        value.steering,
        value.tyres,
        value.lights,
        value.leaks,
      ].includes("ATTENTION") || value.notes.length > 0,
    {
      path: ["notes"],
      message: "Describe inspection findings requiring attention",
    },
  );
export const repairReleaseSchema = z.object({
  brakes: z.enum(["PASS", "NA"]),
  steering: z.enum(["PASS", "NA"]),
  tyres: z.enum(["PASS", "NA"]),
  lights: z.enum(["PASS", "NA"]),
  leaks: z.enum(["PASS", "NA"]),
  roadworthyConfirmed: z.literal(true),
  reference: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(2000).default(""),
});
export const completedRepairSchema = z.object({
  maintenanceReason: z.string().trim().min(1).max(1000),
  replacementIntent: z.string().trim().min(1).max(2000),
  inspection: repairInspectionSchema,
  release: repairReleaseSchema,
});
export const repairControlActionSchema = z
  .object({
    clientRequestId: z.string().uuid(),
    version: z.coerce.number().int().min(0),
    action: z.enum(["START", "RELEASE", "CANCEL"]),
    reason: z.string().trim().min(1).max(1000),
    replacementIntent: z.string().trim().min(1).max(2000).optional(),
    inspection: repairInspectionSchema.optional(),
    release: repairReleaseSchema.optional(),
  })
  .refine(
    (value) =>
      value.action !== "START" ||
      Boolean(value.replacementIntent && value.inspection),
    {
      message: "Starting repair requires an inspection and replacement intent",
    },
  )
  .refine((value) => value.action === "START" || Boolean(value.release), {
    message: "Clearing repair requires roadworthiness confirmation",
  });

export const jobCardStatusSchema = z.enum(["DRAFT", "FINALISED", "CANCELLED"]);
export const jobCardReconciliationQuerySchema = z.object({
  branchId: id.optional(),
  search: z.string().trim().max(200).optional(),
  kind: z.enum(["PARTS", "SERVICES", "RETURN"]).optional(),
  view: z.enum(["ISSUES", "ALL"]).default("ISSUES"),
  page: z.coerce.number().int().min(0).max(1000000).default(0),
  size: z.coerce.number().int().min(1).max(100).default(20),
});

export const jobCardAuditQuerySchema = z
  .object({
    mode: z
      .enum(["STOCK", "SETTLEMENTS", "POSTINGS", "TALLY"])
      .default("SETTLEMENTS"),
    branchId: id.optional(),
    search: z.string().trim().max(200).optional(),
    from: z.string().date().optional(),
    to: z.string().date().optional(),
    view: z.enum(["ISSUES", "ALL"]).default("ISSUES"),
    page: z.coerce.number().int().min(0).max(1000000).default(0),
    size: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    path: ["to"],
    message: "Invalid date range",
  })
  .refine(
    (value) =>
      ["POSTINGS", "TALLY"].includes(value.mode) || (!value.from && !value.to),
    { path: ["from"], message: "Dates apply only to posting-period views" },
  );
export const truckLocationStatusSchema = z.enum(["AT_HO", "IN_TRANSIT"]);

export const jobCardPartLineInputSchema = z.object({
  sparePartId: id,
  batchId: id,
  mechanicId: id.optional(),
  qty: z.coerce.number().int().positive(),
  description: z.string().trim().max(500).optional(),
});

export const jobCardServiceLineInputSchema = z.object({
  serviceProviderId: id,
  sparePartId: id,
  mechanicId: id.optional(),
  qty: z.coerce.number().int().positive(),
  ratePaise: positivePaise,
  description: z.string().trim().max(500).optional(),
});

export const createJobCardSchema = z.object({
  clientRequestId: z.string().uuid(),
  branchId: id,
  vehicleId: id,
  driverId: id,
  truckStatus: truckLocationStatusSchema,
  inDateTime: isoDate,
  openingKm: z.coerce.number().int().min(0),
  remarks: z.string().trim().max(1000).optional(),
  partLines: z.array(jobCardPartLineInputSchema).default([]),
  serviceLines: z.array(jobCardServiceLineInputSchema).default([]),
});

export const updateJobCardSchema = createJobCardSchema
  .omit({ clientRequestId: true })
  .partial({
    branchId: true,
    vehicleId: true,
    driverId: true,
    truckStatus: true,
    inDateTime: true,
    openingKm: true,
  });

export const finaliseJobCardSchema = z.object({
  outDateTime: isoDate,
  closingKm: z.coerce.number().int().min(0),
});

// Create + finalise in one call — used when a brand-new job card is
// finalised immediately (no separate "save the draft, then finalise on a
// second screen" step). Previously the client made two sequential HTTP
// calls for this; this is the single-request equivalent, one transaction.
export const createAndFinaliseJobCardSchema = createJobCardSchema
  .merge(finaliseJobCardSchema)
  .extend({ repairCompletion: completedRepairSchema });

export const cancelJobCardSchema = z.object({
  reason: z.string().trim().min(1, "Cancellation reason is required").max(500),
});

export const undoFinaliseJobCardSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "A reason is required to undo a finalised job card")
    .max(500),
});

export const jobCardListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  branchId: id.optional(),
  vehicleId: id.optional(),
  status: jobCardStatusSchema.optional(),
  page: z.coerce.number().int().min(0).default(0),
  size: z.coerce.number().int().min(1).max(100).default(10),
});

export const jobCardRepairCostQuerySchema = z
  .object({
    page: z.coerce.number().int().min(0).default(0),
    size: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(200).optional(),
    branchId: id.optional(),
    from: z.string().date().optional(),
    to: z.string().date().optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    path: ["to"],
    message: "To date cannot be before from date",
  });
