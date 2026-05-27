import { z } from "zod";

/* -----------------------------
   HELPERS (reuse from vehicle)
------------------------------ */

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

export const requiredNumber = (label: string) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => Number(v))
    .refine((v) => !Number.isNaN(v), {
      message: `${label} is required and must be a valid number`,
    });

export const optionalNumber = (label: string) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === "" || v === null || v === undefined) return undefined;
      const num = Number(v);
      return Number.isNaN(num) ? undefined : num;
    })
    .refine((v) => v === undefined || typeof v === "number", {
      message: `${label} must be a valid number`,
    });

export const optionalDate = z
  .string()
  .optional()
  .transform((v) => {
    if (!v) return undefined;
    const date = new Date(v);
    return Number.isNaN(date.getTime()) ? undefined : date;
  });

/* -----------------------------
   WAREHOUSE SCHEMA
------------------------------ */
export const warehouseSchema = z.object({
  id: z.string(),

  createdAt: z.date(),
  updatedAt: z.date(),

  name: z.string(),
  type: z.string(),
  address: z.string().optional(),
  country: z.string(),
  stateId: z.string(),
  cityId: z.string(),
  branchId: z.string(),

  contactName: z.string().optional(),
  contactPhone: z.string().optional(),

  monthlyRent: z.number().optional(),
  securityDeposit: z.number().optional(),

  agreementDate: z.date().optional(),
  expiryDate: z.date().optional(),

  length: z.number().optional(),
  width: z.number().optional(),
  breadth: z.number().optional(),

  gateNo: z.string().optional(),
  storageCapacity: z.number().optional(),
});
export const createWarehouseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Warehouse name is required")
    .max(100, "Warehouse name cannot exceed 100 characters"),

  type: z
    .string()
    .trim()
    .min(1, "Warehouse type is required")
    .max(50, "Warehouse type is too long (max 50 characters)"),

  address: optionalString,

  country: z
    .string()
    .trim()
    .min(1, "Country is required")
    .max(50, "Country name is too long"),

  stateId: z
    .string()
    .min(1, "Please select a state"),

  cityId: z
    .string()
    .min(1, "Please select a city"),

  branchId: z
    .string()
    .min(1, "Please select a branch"),

  contactName: optionalString.refine(
    (v) => !v || v.length <= 50,
    "Contact name cannot exceed 50 characters"
  ),

  contactPhone: optionalString.refine(
    (v) =>
      !v ||
      /^[0-9]{10,15}$/.test(v),
    "Enter a valid phone number (10–15 digits)"
  ),

  monthlyRent: optionalNumber("Monthly rent").refine(
    (v) => v === undefined || v >= 0,
    "Monthly rent cannot be negative"
  ),

  securityDeposit: optionalNumber("Security deposit").refine(
    (v) => v === undefined || v >= 0,
    "Security deposit cannot be negative"
  ),

  agreementDate: optionalDate,

  expiryDate: optionalDate,

  length: optionalNumber("Length (feet)").refine(
    (v) => v === undefined || (v > 0 && v <= 10000),
    "Length must be between 1 and 10000"
  ),

  width: optionalNumber("Width (feet)").refine(
    (v) => v === undefined || (v > 0 && v <= 10000),
    "Width must be between 1 and 10000"
  ),

  breadth: optionalNumber("Breadth (feet)").refine(
    (v) => v === undefined || (v > 0 && v <= 10000),
    "Breadth must be between 1 and 10000"
  ),

  gateNo: optionalString.refine(
    (v) => !v || v.length <= 20,
    "Gate number cannot exceed 20 characters"
  ),

  storageCapacity: optionalNumber("Storage capacity").refine(
    (v) => v === undefined || v >= 0,
    "Storage capacity cannot be negative"
  ),
});
export const updateWarehouseSchema = createWarehouseSchema.partial();