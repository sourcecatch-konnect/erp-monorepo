import { z } from "zod";

export const stateSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const createStateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "State name is required")
    .max(100, "State name is too long"),
});

export const updateStateSchema =
  createStateSchema.partial();
