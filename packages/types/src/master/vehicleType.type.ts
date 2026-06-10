import { z } from "zod";
import {
  vehicleTypeSchemaShape,
  createVehicleTypeSchema,
  updateVehicleTypeSchema,
} from "@skerp/validators";

export type VehicleType = z.infer<typeof vehicleTypeSchemaShape>;
export type CreateVehicleTypeBody = z.output<typeof createVehicleTypeSchema>;
export type CreateVehicleTypeFormInput = z.input<typeof createVehicleTypeSchema>;
export type UpdateVehicleTypeBody = z.output<typeof updateVehicleTypeSchema>;
