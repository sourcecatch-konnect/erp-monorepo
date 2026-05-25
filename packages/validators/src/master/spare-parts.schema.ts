import z from "zod";
import { optionalString, partTypeSchema } from "./spare-category.schema";

const numberField = (message: string) =>
  z
    .union([z.string(), z.number()])
    .transform((value) => Number(value))
    .refine((value) => !Number.isNaN(value), message);

const intField = (message: string) =>
  numberField(message).refine((value) => Number.isInteger(value), message);
export const createSparePartSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Spare part name is required")
    .max(100, "Spare part name cannot exceed 100 characters"),

  type: partTypeSchema,

  categoryId: z.string().min(1, "Category is required"),

  supplierId: z.string().min(1, "Supplier is required"),

  rate: numberField("Rate is required")
    .refine((value) => value >= 0, "Rate cannot be negative")
    .refine((value) => value <= 9999999, "Rate is too high"),

  minimumStock: intField("Minimum stock is required")
    .refine((value) => value >= 0, "Minimum stock cannot be negative")
    .refine((value) => value <= 999999, "Minimum stock is too high"),

  unit: z
    .string()
    .trim()
    .min(1, "Unit is required")
    .max(30, "Unit cannot exceed 30 characters"),

  isRecyclable: z.boolean().default(false),

  isBatchTracked: z.boolean().default(false),

  description: optionalString,
});

export const updateSparePartSchema = createSparePartSchema.partial();

