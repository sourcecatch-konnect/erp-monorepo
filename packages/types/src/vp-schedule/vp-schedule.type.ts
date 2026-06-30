import { z } from "zod";
import {
  vpScheduleSchema,
  createVPScheduleSchema,
  updateVPScheduleSchema,
  confirmVPScheduleSchema,
  cancelVPScheduleSchema,
} from "@skerp/validators";

export type VPSchedule = z.infer<typeof vpScheduleSchema>;

export type CreateVPScheduleBody = z.output<typeof createVPScheduleSchema>;
export type UpdateVPScheduleBody = z.output<typeof updateVPScheduleSchema>;

export type CreateVPScheduleFormInput = z.input<typeof createVPScheduleSchema>;
export type UpdateVPScheduleFormInput = z.input<typeof updateVPScheduleSchema>;

export type ConfirmVPScheduleBody = z.output<typeof confirmVPScheduleSchema>;
export type CancelVPScheduleBody = z.output<typeof cancelVPScheduleSchema>;