import { z } from "zod";

export const UnitCategoryEnum = z.enum([
  "WEIGHT",
  "PACKAGING",
  "COUNT",
  "LENGTH",
  "VOLUME",
]);

const optionalText = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().optional(),
);

const optionalDecimal = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.coerce.number().positive("Conversion factor must be greater than 0").optional(),
);

export const unitOfMeasureSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  category: UnitCategoryEnum,

  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createUnitOfMeasureSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(30, "Code must be at most 30 characters")
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1, "Name is required").max(100),
  category: UnitCategoryEnum,

  isActive: z.boolean().default(true),
});

export const updateUnitOfMeasureSchema = createUnitOfMeasureSchema.partial();

export type UnitOfMeasure = z.infer<typeof unitOfMeasureSchema>;
export type CreateUnitOfMeasureBody = z.output<typeof createUnitOfMeasureSchema>;
export type UpdateUnitOfMeasureBody = z.output<typeof updateUnitOfMeasureSchema>;
