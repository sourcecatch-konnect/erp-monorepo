// packages/validators/src/master/area.schema.ts

import { z } from "zod";

export const areaSchema = z.object({
  id: z.string(),
  name: z.string(),
  cityId: z.string(),

  city: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
});

export const createAreaSchema = z.object({
  name: z.string().min(1, "Area name is required"),
  cityId: z.string().min(1, "City is required"),
});

export const updateAreaSchema = z.object({
  name: z.string().min(1).optional(),
  cityId: z.string().min(1).optional(),
});