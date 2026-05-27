import { z } from "zod";

import {
  railwayFreightMatrixSchema,
  createRailwayFreightMatrixSchema,
  updateRailwayFreightMatrixSchema,
} from "@skerp/validators";

export type RailwayFreightMatrix =
  z.infer<
    typeof railwayFreightMatrixSchema
  >;

export type CreateRailwayFreightMatrixBody =
  z.output<
    typeof createRailwayFreightMatrixSchema
  >;

export type UpdateRailwayFreightMatrixBody =
  z.output<
    typeof updateRailwayFreightMatrixSchema
  >;

export type CreateRailwayFreightMatrixFormInput =
  z.input<
    typeof createRailwayFreightMatrixSchema
  >;

export type UpdateRailwayFreightMatrixFormInput =
  z.input<
    typeof updateRailwayFreightMatrixSchema
  >;