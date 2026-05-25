import { z } from "zod";
import {
  driverSchema,
  createDriverSchema,
  updateDriverSchema,
} from "@skerp/validators";

export type Driver = z.infer<typeof driverSchema>;

export type CreateDriverBody = z.output<typeof createDriverSchema>;
export type UpdateDriverBody = z.output<typeof updateDriverSchema>;

export type CreateDriverFormInput = z.input<typeof createDriverSchema>;
