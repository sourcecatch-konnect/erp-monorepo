import { z } from "zod";

export const createCitySchema = z.object({
  name: z.string().min(1, "City name is required"),
  stateId: z.string().min(1, "State is required"),
});

export const updateCitySchema = z.object({
  name: z.string().min(1).optional(),
  stateId: z.string().min(1).optional(),
});