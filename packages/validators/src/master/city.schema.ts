import { z } from "zod";

export const citySchema = z.object({
  id: z.string(),
  name: z.string(),
  stateId: z.string(),
  state: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const createCitySchema = z.object({
  name: z.string().min(1, "City name is required"),
  stateId: z.string().min(1, "State is required"),
});

export const updateCitySchema = z.object({
  name: z.string().min(1).optional(),
  stateId: z.string().min(1).optional(),
});
