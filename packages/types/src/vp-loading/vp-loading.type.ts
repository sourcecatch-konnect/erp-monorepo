import { z } from "zod";

import {
  cancelVPLoadingSchema,
  completeVPWagonLoadingSchema,
  createVPLoadingAllocationSchema,
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
