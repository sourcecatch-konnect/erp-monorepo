import { z } from "zod";
import {
  routeSchema,
  createRouteSchema,
  updateRouteSchema,
} from "@skerp/validators";

export type Route = z.infer<typeof routeSchema>;

export type CreateRouteBody = z.output<typeof createRouteSchema>;
export type UpdateRouteBody = z.output<typeof updateRouteSchema>;

export type CreateRouteFormInput = z.input<typeof createRouteSchema>;
export type UpdateRouteFormInput = z.input<typeof updateRouteSchema>;