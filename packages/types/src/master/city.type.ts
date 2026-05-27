import { z } from "zod";
import {
  citySchema,
  createCitySchema,
  updateCitySchema,
} from "@skerp/validators";

export type City = z.infer<typeof citySchema>;
export type CreateCityBody = z.infer<typeof createCitySchema>;
export type UpdateCityBody = z.infer<typeof updateCitySchema>;
