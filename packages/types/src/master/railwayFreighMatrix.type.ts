import { z } from "zod";

import {
  railwayFreightMatrixSchema,
  createRailwayFreightMatrixSchema,
  updateRailwayFreightMatrixSchema,
  citySchema,
} from "@skerp/validators";

export type RailwayFreightMatrix =
  z.infer<
    typeof railwayFreightMatrixSchema
  >;
export type RailwayFreightMatrixWithRelations =
  RailwayFreightMatrix & {
    sourceCity?: z.infer<typeof citySchema>;
    destinationCity?: z.infer<typeof citySchema>;
    wagon?: {
      name: string;
    };
  };
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