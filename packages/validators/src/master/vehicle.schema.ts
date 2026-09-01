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
  ownershipType: ownershipTypeSchema,
  transportId: z.string().nullable().optional(),
  transport: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .nullable()
    .optional(),
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

const vehicleInputSchema = z.object({
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
  ownershipType: ownershipTypeSchema,
  transportId: optionalString,
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

wheels: optionalString.refine((value) => {
    if (value === undefined) return true;

    const num = Number(value);

    return Number.isInteger(num) && num > 0 && num % 2 === 0;
  }, "Please enter wheels correctly"),

  capacityMT: numberField("Capacity is required")
    .refine((value) => value > 0, "Capacity must be greater than 0")
    .refine((value) => value <= 100, "Capacity cannot exceed 100 MT"),

openingKM: intField("Opening KM is required")
  .refine((value) => value >= 0, "Opening KM cannot be negative"),

currentKM: intField("Current KM is required")
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

  status: vehicleStatusSchema.optional().default("AVAILABLE"),
});

export const createVehicleSchema = vehicleInputSchema.superRefine(
  (vehicle, ctx) => {
    if (
      vehicle.ownershipType === "Market_Vehicle" &&
      !vehicle.transportId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["transportId"],
        message: "Transporter is required for a market vehicle",
      });
    }

    if (vehicle.ownershipType === "Own_Vehicle" && vehicle.transportId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["transportId"],
        message: "Own vehicles cannot be attached to a transporter",
      });
    }
  },
);

export const updateVehicleSchema = vehicleInputSchema.partial();
