import { z } from "zod";

import {
  rateMatrixSchema,
  createRateMatrixSchema,
  updateRateMatrixSchema,
} from "@skerp/validators";
import { AgreementWithRelations } from "./agreement.type.js";
export type RateMatrix =
  z.infer<
    typeof rateMatrixSchema
  >;
export type RateMatrixWithRelations = RateMatrix & {
  agreement?: AgreementWithRelations;

  route?: {
    id: string;
    sourceCity?: {
      id: string;
      name: string;
    };
    destinationCity?: {
      id: string;
      name: string;
    };
  };
};


export type CreateRateMatrixBody =
  z.output<
    typeof createRateMatrixSchema
  >;

export type UpdateRateMatrixBody =
  z.output<
    typeof updateRateMatrixSchema
  >;

export type CreateRateMatrixFormInput =
  z.input<
    typeof createRateMatrixSchema
  >;

export type UpdateRateMatrixFormInput =
  z.input<
    typeof updateRateMatrixSchema
  >;