import { z } from "zod";
import {
  areaSchema,
  createAreaSchema,
  updateAreaSchema,
} from "@skerp/validators";

export type Area = z.infer<typeof areaSchema> & {
  city?: {
    id: string;
    name: string;
    state?: {
      id: string;
      name: string;
    } | null;
  } | null;
};

export type CreateAreaBody = z.infer<typeof createAreaSchema>;
export type CreateAreaFormInput = z.input<typeof createAreaSchema>;
export type UpdateAreaBody = z.infer<typeof updateAreaSchema>;
