import { z } from "zod";

const optionalNumberField = (message: string) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === "" || value === undefined || value === null) {
        return undefined;
      }
      return Number(value);
    })
    .refine((value) => value === undefined || !Number.isNaN(value), message);

export const vehicleTypeSchemaShape = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  freightRangeFrom: z.number().nullable().optional(),
  freightRangeTo: z.number().nullable().optional(),
  isActive: z.boolean(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const createVehicleTypeSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, "Code is required")
      .max(30, "Code cannot exceed 30 characters")
      .transform((value) => value.replace(/\s+/g, "_")),

    name: z
      .string()
      .trim()
      .min(1, "Name is required")
      .max(60, "Name cannot exceed 60 characters"),

    freightRangeFrom: optionalNumberField("Enter a valid amount").refine(
      (value) => value === undefined || value >= 0,
      "Cannot be negative"
    ),

    freightRangeTo: optionalNumberField("Enter a valid amount").refine(
      (value) => value === undefined || value >= 0,
      "Cannot be negative"
    ),

    isActive: z.boolean().default(true),
  })
  .refine(
    (data) =>
      data.freightRangeFrom === undefined ||
      data.freightRangeTo === undefined ||
      data.freightRangeTo >= data.freightRangeFrom,
    {
      message: "Max freight must be greater than or equal to min freight",
      path: ["freightRangeTo"],
    }
  );

export const updateVehicleTypeSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, "Code is required")
      .max(30, "Code cannot exceed 30 characters")
      .transform((value) => value.replace(/\s+/g, "_"))
      .optional(),
    name: z
      .string()
      .trim()
      .min(1, "Name is required")
      .max(60, "Name cannot exceed 60 characters")
      .optional(),
    freightRangeFrom: optionalNumberField("Enter a valid amount"),
    freightRangeTo: optionalNumberField("Enter a valid amount"),
    isActive: z.boolean().optional(),
  });
