import { z } from "zod";
import {
  createStateSchema,
  stateSchema,
  updateStateSchema,
} from "@skerp/validators";

export type State = z.infer<typeof stateSchema>;
export type CreateStateBody = z.infer<typeof createStateSchema>;
export type UpdateStateBody = z.infer<typeof updateStateSchema>;
