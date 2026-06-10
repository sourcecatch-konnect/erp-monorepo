import { z } from "zod";

// Accept string (from form inputs) or number, coerce to number.
const requiredNumber = (field: string) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => (v === "" ? NaN : Number(v)))
    .refine((v) => !Number.isNaN(v), `${field} must be a number`);


export const wagonSchema = z.object({
  id: z.string(),

  name: z.string(),

  height: z.number(),
  width: z.number(),
  weight: z.number(),
});

export const createWagonSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Wagon name is required")
    .max(
      100,
      "Name cannot exceed 100 characters"
    ),

  height: requiredNumber("Height").refine(
    (v: number) => v > 0,
    "Height must be greater than 0"
  ),

  width: requiredNumber("Width").refine(
    (v: number) => v > 0,
    "Width must be greater than 0"
  ),

  weight: requiredNumber("Weight").refine(
    (v: number) => v > 0,
    "Weight must be greater than 0"
  ),
});

export const updateWagonSchema =
  createWagonSchema.partial();