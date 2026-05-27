import { z } from "zod";

export const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

export const spareTypeSchema = z.enum([
  "Item",
  "Service",
]);

export const spareCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: spareTypeSchema,
  ledgerName: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createSpareCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name cannot exceed 100 characters"),

  type: spareTypeSchema,
  ledgerName: optionalString,
});

export const updateSpareCategorySchema =
  createSpareCategorySchema.partial();

export const partTypeSchema = z.enum([
  "Item",
  "Service",
]);

export const sparePartSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: partTypeSchema,

  categoryId: z.string(),
  supplierId: z.string(),

  // Relations
  category: z.object({
    id: z.string(),
    name: z.string(),
  }).optional(),

  supplier: z.object({
    id: z.string(),
    name: z.string(),
  }).optional(),

  rate: z.number(),
  minimumStock: z.number(),
  unit: z.string(),
  isRecyclable: z.boolean(),
  isBatchTracked: z.boolean(),
  description: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});