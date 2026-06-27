import { z } from "zod";
import {
  mrrrSchema,
  createMRRRSchema,
  updateMRRRSchema,
  updateMRRRRowsSchema,
  submitMRRRSchema,
  cancelMRRRSchema,
} from "@skerp/validators";

export type MRRR = z.infer<typeof mrrrSchema>;

export type CreateMRRRBody = z.output<typeof createMRRRSchema>;
export type UpdateMRRRBody = z.output<typeof updateMRRRSchema>;
export type UpdateMRRRRowsBody = z.output<typeof updateMRRRRowsSchema>;
export type SubmitMRRRBody = z.output<typeof submitMRRRSchema>;
export type CancelMRRRBody = z.output<typeof cancelMRRRSchema>;

export type CreateMRRRFormInput = z.input<typeof createMRRRSchema>;
export type UpdateMRRRFormInput = z.input<typeof updateMRRRSchema>;
export type UpdateMRRRRowsFormInput = z.input<typeof updateMRRRRowsSchema>;

export type MRRRRow = NonNullable<MRRR["rows"]>[number];

export type MRRRWithRelations = MRRR & {
  vpSchedule?: NonNullable<MRRR["vpSchedule"]>;
  rows?: MRRRRow[];
};

/**
 * Use this for create/edit MR/RR main form.
 * Create needs vpScheduleId.
 * Edit needs rakeType and remarks.
 */
export type MRRRFormValues = {
  vpScheduleId: string;
  rakeType?: CreateMRRRFormInput["rakeType"];
  remarks?: CreateMRRRFormInput["remarks"];
};

/**
 * Use this for rows edit form on detail page.
 */
export type MRRRRowsFormValues = UpdateMRRRRowsFormInput;