import { z } from "zod";

const optionalNullableString = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional();

export const createAreaSchema = z.object({
  name: z.string().trim().min(1, "Area name is required"),
  cityId: z.string().min(1, "City is required"),
  isRailHead: z.boolean().default(false),

  googlePlaceId: optionalNullableString,
  formattedAddress: optionalNullableString,
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
});

export const updateAreaSchema = createAreaSchema.partial();

export const areaSchema = createAreaSchema.extend({
  id: z.string(),
});
