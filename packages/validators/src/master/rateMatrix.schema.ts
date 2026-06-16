import { z } from "zod";

/* -----------------------------
   HELPERS
------------------------------ */

const requiredNumber = (label: string) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => Number(v))
    .refine((v) => !Number.isNaN(v), {
      message: `${label} is required`,
    });

const optionalNumber = (label: string) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === "" || v === undefined || v === null) {
        return undefined;
      }

      const num = Number(v);

      return Number.isNaN(num) ? undefined : num;
    })
    .refine(
      (v) => v === undefined || typeof v === "number",
      {
        message: `${label} must be valid`,
      }
    );

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

/* -----------------------------
   BASE SCHEMA (REUSABLE)
------------------------------ */

export const rateMatrixBaseSchema = z.object({
  agreementId: z.string().min(1, "Please select agreement"),

  routeId: z.string().min(1, "Please select route"),

  vehicleTypeId: z.string().min(1, "Please select vehicle type"),

  unitId: z.string().optional(),

  transportType: z.enum(["RAIL_ROAD", "ROAD"], {
    message: "Please select transport type",
  }),

  rate: requiredNumber("Rate").refine(
    (v) => v > 0,
    "Rate must be greater than 0"
  ),

  transitDays: optionalNumber("Transit days"),

  remarks: optionalString,
});

/* -----------------------------
   CREATE SCHEMA (WITH BUSINESS RULE)
------------------------------ */

export const createRateMatrixSchema =
  rateMatrixBaseSchema.superRefine((data, ctx) => {
    const isContainer =
      data.vehicleTypeId?.toLowerCase() === "container";

    if (isContainer && !data.unitId) {
      ctx.addIssue({
        path: ["unitId"],
        code: z.ZodIssueCode.custom,
        message: "Unit is required for Container vehicle type",
      });
    }
  });

/* -----------------------------
   UPDATE SCHEMA
------------------------------ */

export const updateRateMatrixSchema =
  rateMatrixBaseSchema.partial();

/* -----------------------------
   RATE MATRIX (DB SCHEMA)
------------------------------ */

export const rateMatrixSchema = z.object({
  id: z.string(),

  agreementId: z.string(),

  routeId: z.string(),

  vehicleTypeId: z.string().optional().nullable(),

  unitId: z.string().optional().nullable(),

  transportType: z.enum(["RAIL_ROAD", "ROAD"]),

  rate: z.number(),

  transitDays: z.number().optional().nullable(),

  remarks: z.string().optional().nullable(),

  createdAt: z.date().optional(),

  updatedAt: z.date().optional(),
});

/* -----------------------------
   RATE UNIT SCHEMA
------------------------------ */

export const rateUnitSchema = z.object({
  id: z.string(),
  unitValue: z.number(),
  unitType: z.enum(["HQ", "LQ"]),
  isActive: z.boolean().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const createRateUnitSchema = z.object({
  unitValue: z
    .union([z.string(), z.number()])
    .transform((v) => Number(v))
    .refine((v) => !Number.isNaN(v), {
      message: "Unit value is required",
    })
    .refine((v) => v > 0, {
      message: "Unit value must be greater than 0",
    }),

  unitType: z.enum(["HQ", "LQ"], {
    message: "Please select unit type",
  }),

  isActive: z.boolean().optional(),
});

export const updateRateUnitSchema =
  createRateUnitSchema.partial();