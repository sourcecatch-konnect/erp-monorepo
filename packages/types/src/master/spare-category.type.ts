import { createSpareCategorySchema, spareCategorySchema, updateSpareCategorySchema } from "@skerp/validators";
import { z } from "zod";
export type SpareCategory =
  z.infer<typeof spareCategorySchema>;

export type CreateSpareCategoryBody =
  z.output<typeof createSpareCategorySchema>;

export type UpdateSpareCategoryBody =
  z.output<typeof updateSpareCategorySchema>;
export type CreateSpareCategoryFormInput =
  z.input<typeof createSpareCategorySchema>;
  