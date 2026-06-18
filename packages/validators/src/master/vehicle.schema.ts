import { z } from "zod";
const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const optionalDateString = z
  .string()
  .optional()
  .transform((value) => {
    if (!value) return undefined;

    return new Date(value).toISOString();
  });
export const bodyTypeSchema = z.enum(["HQ", "LQ"]);

const optionalBodyType = z
  .union([bodyTypeSchema, z.literal("")])
  .optional()
  .transform((value) => (value ? value : undefined));
const numberField = (message: string) =>
  z
    .union([z.string(), z.number()])
    .transform((value) => Number(value))
    .refine((value) => !Number.isNaN(value), message);

const intField = (message: string) =>
  numberField(message).refine((value) => Number.isInteger(value), message);

export const ownershipTypeSchema = z.enum(["Own_Vehicle", "Market_Vehicle"]);

export const vehicleTypeSchema = z.enum([
  "Container",
  "Open_Body",
  "TATA_407",
  "DCM_Lorry",
  "DI_Pickup",
]);

export const vehicleStatusSchema = z.enum(["AVAILABLE", "ON_TRIP"]);

export const vehicleSchema = z.object({
  id: z.string(),
  vehicleNumber: z.string(),
  chasisNumber: z.string(),
  engineNumber: z.string(),
  ownershipType: ownershipTypeSchema,
  vehicleTypeId: z.string(),
  capacityMT: z.number(),
  bodyType: bodyTypeSchema.nullable().optional(),
  wheels: z.string().nullable().optional(),
  lengthFeet: z.string().nullable().optional(),
  openingKM: z.number(),
  currentKM: z.number(),
  purchaseDate: z.string().nullable().optional(),
  insuranceNumber: z.string().nullable().optional(),
  insuranceCompany: z.string().nullable().optional(),
  insuranceIssueDate: z.string().nullable().optional(),
  insuranceDueDate: z.string().nullable().optional(),
  status: vehicleStatusSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createVehicleSchema = z.object({
  vehicleNumber: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase().replace(/\s+/g, ""))
    .pipe(
      z
        .string()
        .min(1, "Vehicle number is required")
        .max(15, "Vehicle number cannot exceed 15 characters")
        .regex(
          /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/,
          "Enter valid vehicle number, e.g. MH31AB1234"
        )
    ),
  chasisNumber: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(
      z
        .string()
        .length(17, "Chasis number must be exactly 17 characters")
        .regex(/^[A-Z0-9]+$/, "Chasis number can only contain letters and numbers")
    ),
  engineNumber: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(
      z
        .string()
        .min(6, "Engine number must be at least 6 characters")
        .max(20, "Engine number cannot exceed 20 characters")
        .regex(/^[A-Z0-9]+$/, "Engine number can only contain letters and numbers")
    ),

  ownershipType: ownershipTypeSchema,
  vehicleTypeId: z.string().min(1, "Vehicle type is required"),
bodyType: optionalBodyType,

lengthFeet: optionalString.refine(
  (value) => {
    if (value === undefined || value === "") return true;

    const num = Number(value);

    return !Number.isNaN(num) && num >= 1 && num <= 100;
  },
  "Length must be between 1 and 100 feet"
),

wheels: z
  .string()
  .trim()
  .min(1, "Wheels is required")
  .refine((value) => {
    const num = Number(value);

    return Number.isInteger(num) && num > 0 && num % 2 === 0;
  }, "Please enter wheels correctly"),

  capacityMT: numberField("Capacity is required")
    .refine((value) => value > 0, "Capacity must be greater than 0")
    .refine((value) => value <= 100, "Capacity cannot exceed 100 MT"),

openingKM: z
  .string()
  .min(1, "Opening KM is required")
  .transform(Number)
  .refine(Number.isInteger, "Opening KM must be a whole number")
  .refine((value) => value >= 0, "Opening KM cannot be negative"),

currentKM: z
  .string()
  .min(1, "Current KM is required")
  .transform(Number)
  .refine(Number.isInteger, "Current KM must be a whole number")
  .refine((value) => value >= 0, "Current KM cannot be negative"),
  purchaseDate: optionalDateString,

  insuranceNumber: z
    .string()
    .trim()
    .transform((value) => (value ? value.toUpperCase() : undefined))
    .pipe(
      z
        .string()
        .max(30, "Insurance number cannot exceed 30 characters")
        .regex(
          /^[A-Z0-9/-]*$/,
          "Insurance number can only contain letters, numbers, / and -"
        )
        .optional()
    ),
  insuranceCompany: optionalString,
  insuranceIssueDate: optionalDateString,
  insuranceDueDate: optionalDateString,

  status: vehicleStatusSchema,
});

export const updateVehicleSchema = createVehicleSchema.partial();