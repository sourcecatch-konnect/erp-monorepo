import { z } from "zod";

import {
  createUnitOfMeasureSchema,
  unitOfMeasureSchema,
  updateUnitOfMeasureSchema,
} from "@skerp/validators";

export type UnitCategory =
  | "WEIGHT"
  | "PACKAGING"
  | "COUNT"
  | "LENGTH"
  | "VOLUME";

export type UnitOfMeasure = z.infer<typeof unitOfMeasureSchema>;

export type CreateUnitOfMeasureBody = z.output<
  typeof createUnitOfMeasureSchema
>;

export type UpdateUnitOfMeasureBody = z.output<
  typeof updateUnitOfMeasureSchema
>;

export type CreateUnitOfMeasureFormInput = z.input<
  typeof createUnitOfMeasureSchema
>;

export type UpdateUnitOfMeasureFormInput = z.input<
  typeof updateUnitOfMeasureSchema
>;
