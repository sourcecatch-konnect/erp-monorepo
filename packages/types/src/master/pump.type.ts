import { z } from "zod";

import {
  pumpSchema,
  createPumpSchema,
  updatePumpSchema,
} from "@skerp/validators";

export type Pump = z.infer<typeof pumpSchema> & {
  city?: {
    id: string;
    name: string;
  } | null;

  state?: {
    id: string;
    name: string;
  } | null;
};

export type CreatePumpBody =
  z.output<typeof createPumpSchema>;

export type UpdatePumpBody =
  z.output<typeof updatePumpSchema>;

export type CreatePumpFormInput =
  z.input<typeof createPumpSchema>;

export type UpdatePumpFormInput =
  z.input<typeof updatePumpSchema>;