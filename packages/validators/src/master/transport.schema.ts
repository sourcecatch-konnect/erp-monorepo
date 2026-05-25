import { z } from "zod";

export const transportSchema = z.object({
  id: z.string(),
  name: z.string(),
  stateId: z.string(),
  cityId: z.string(),
  country: z.string(),
  phoneNo: z.string(),
});

export const createTransportSchema = z.object({
  name: z.string().min(1, "Transport name is required"),
  stateId: z.string().min(1, "State is required"),
  cityId: z.string().min(1, "City is required"),
  country: z.string().min(1, "Country is required"),
  phoneNo: z
    .string()
    .min(1, "Phone number is required")
    .min(10, "Phone number must be at least 10 digits"),
});

export const updateTransportSchema = createTransportSchema.partial();