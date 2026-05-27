import { z } from "zod";

import {
  labourSchema,
  createLabourSchema,
  updateLabourSchema,
} from "@skerp/validators";

export type Labour =
  z.infer<typeof labourSchema>;

export type LabourWithRelations =
  Labour & {
    city?: {
      id: string;
      name: string;
    };

    branch?: {
      id: string;
      name: string;
    };
  };

export type CreateLabourBody =
  z.output<
    typeof createLabourSchema
  >;

export type UpdateLabourBody =
  z.output<
    typeof updateLabourSchema
  >;

export type CreateLabourFormInput =
  z.input<
    typeof createLabourSchema
  >;

export type UpdateLabourFormInput =
  z.input<
    typeof updateLabourSchema
  >;