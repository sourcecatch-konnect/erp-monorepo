import type { z } from "zod";

import {
  calculateRailRakeOperationSchema,
  createRailRakeOperationSchema,
  submitRailRakeOperationSchema,
  updateRailRakeOperationSchema,
} from "@skerp/validators";

export type RailRakeOperationStage = "ORIGIN_RAILHEAD" | "DESTINATION_BRANCH";
export type RailRakeOperationStatus = "DRAFT" | "SUBMITTED" | "CANCELLED";
export type RailRakeChargeType = "DEMURRAGE" | "WHARFAGE";

export type CreateRailRakeOperationBody = z.output<
  typeof createRailRakeOperationSchema
>;
export type UpdateRailRakeOperationBody = z.output<
  typeof updateRailRakeOperationSchema
>;
export type CalculateRailRakeOperationBody = z.output<
  typeof calculateRailRakeOperationSchema
>;
export type SubmitRailRakeOperationBody = z.output<
  typeof submitRailRakeOperationSchema
>;

export type RailRakeOperationRakeOption = {
  id: string;
  rakeNumber: string;
  status: string;
  stage: RailRakeOperationStage;
  scheduleNumber: string;
  scheduleDate: string;
  branch: { id: string; name: string; branchCode: string };
  area: { id: string; name: string; formattedAddress: string | null };
  fromBranch: { id: string; name: string; branchCode: string };
  toBranch: { id: string; name: string; branchCode: string };
  sourceArea: { id: string; name: string; formattedAddress: string | null };
  destinationArea: {
    id: string;
    name: string;
    formattedAddress: string | null;
  };
};

export type RailRakeOperationCalculation = {
  actualMinutes: number;
  freeMinutes: number;
  chargeableMinutes: number;
  billableHours: number;
  ratePerHourPaise: number;
  grossAmountPaise: number;
  waiverAmountPaise: number;
  netPayableAmountPaise: number;
  paidAmountPaise: number;
  balanceAmountPaise: number;
  calculationVersion: number;
  calculationCode: string;
};
