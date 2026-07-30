import { z } from "zod";

import {
  cancelVPLoadingSchema,
  completeVPWagonLoadingSchema,
  createVPLoadingAllocationSchema,
  finaliseVPScheduleLoadingSchema,
  updateVPWagonLoadingLabourSchema,
  updateVPLoadingAllocationSchema,
  vpLoadingGoodsInputSchema,
  vpLoadingMeasurementSourceSchema,
} from "@skerp/validators";

export type VPLoadingMeasurementSource = z.infer<
  typeof vpLoadingMeasurementSourceSchema
>;

export type VPLoadingGoodsInput = z.output<typeof vpLoadingGoodsInputSchema>;
export type CreateVPLoadingAllocationBody = z.output<
  typeof createVPLoadingAllocationSchema
>;
export type UpdateVPLoadingAllocationBody = z.output<
  typeof updateVPLoadingAllocationSchema
>;
export type CancelVPLoadingBody = z.output<typeof cancelVPLoadingSchema>;
export type CompleteVPWagonLoadingBody = z.output<
  typeof completeVPWagonLoadingSchema
>;
export type FinaliseVPScheduleLoadingBody = z.output<
  typeof finaliseVPScheduleLoadingSchema
>;
export type UpdateVPWagonLoadingLabourBody = z.output<
  typeof updateVPWagonLoadingLabourSchema
>;
