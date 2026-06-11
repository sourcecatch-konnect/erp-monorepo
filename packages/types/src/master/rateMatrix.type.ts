import { z } from "zod";

import {
  rateMatrixSchema,
  createRateMatrixSchema,
  updateRateMatrixSchema,
  rateUnitSchema,
  createRateUnitSchema,
  updateRateUnitSchema
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

  vehicleType?: {
    id: string;
    name: string;
  };

  unit?: {
    id: string;
    unitValue: number;
    unitType: "HQ" | "LQ";
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
  export type RateUnit = z.infer<typeof rateUnitSchema>;

export type CreateRateUnitBody = z.output<
  typeof createRateUnitSchema
>;

export type UpdateRateUnitBody = z.output<
  typeof updateRateUnitSchema
>;

export type CreateRateUnitFormInput = z.input<
  typeof createRateUnitSchema
>;

export type UpdateRateUnitFormInput = z.input<
  typeof updateRateUnitSchema
>;