import { z } from "zod";
import {
  vehicleSchema,
  createVehicleSchema,
  updateVehicleSchema,
} from "@skerp/validators";

export type Vehicle = z.infer<typeof vehicleSchema>;

export type CreateVehicleBody = z.output<typeof createVehicleSchema>;
export type UpdateVehicleBody = z.output<typeof updateVehicleSchema>;

export type CreateVehicleFormInput = z.input<typeof createVehicleSchema>;