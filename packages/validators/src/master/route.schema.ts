import { z } from "zod";

export const routeSchema = z.object({
  id: z.string(),

  sourceCityId: z.string(),
  destinationCityId: z.string(),

  sourceCity: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),

  destinationCity: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),

  rateMatrixEntries: z.any().optional(),
  LorryReceipt: z.any().optional(),
  VehicleTrip: z.any().optional(),
});
const baseRouteSchema = z.object({
  sourceCityId: z.string().min(1, "Source city is required"),
  destinationCityId: z.string().min(1, "Destination city is required"),
});
export const createRouteSchema = baseRouteSchema.refine(
  (data) => data.sourceCityId !== data.destinationCityId,
  {
    message: "Source and destination city cannot be the same",
    path: ["destinationCityId"],
  }
);
export const updateRouteSchema = baseRouteSchema
  .partial()
  .refine(
    (data) => {
      if (!data.sourceCityId || !data.destinationCityId) return true;
      return data.sourceCityId !== data.destinationCityId;
    },
    {
      message: "Source and destination city cannot be same",
      path: ["destinationCityId"],
    }
  );