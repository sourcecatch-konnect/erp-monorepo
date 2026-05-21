import { z } from "zod";

export const createStateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "State name is required")
    .max(100, "State name is too long"),
});

export const updateStateSchema =
  createStateSchema.partial();