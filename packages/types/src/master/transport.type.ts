import { z } from "zod";
import {
  transportSchema,
  createTransportSchema,
  updateTransportSchema,
} from "@skerp/validators";

export type Transport = z.infer<typeof transportSchema> & {
  state?: {
    id: string;
    name: string;
  } | null;
  city?: {
    id: string;
    name: string;
  } | null;
};

export type CreateTransportBody = z.infer<typeof createTransportSchema>;
export type UpdateTransportBody = z.infer<typeof updateTransportSchema>;