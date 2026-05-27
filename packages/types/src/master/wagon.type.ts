import { z } from "zod";

import {
  wagonSchema,
  createWagonSchema,
  updateWagonSchema,
} from "@skerp/validators";

export type Wagon =
  z.infer<typeof wagonSchema>;

export type CreateWagonBody =
  z.output<
    typeof createWagonSchema
  >;

export type UpdateWagonBody =
  z.output<
    typeof updateWagonSchema
  >;

export type CreateWagonFormInput =
  z.input<
    typeof createWagonSchema
  >;

export type UpdateWagonFormInput =
  z.input<
    typeof updateWagonSchema
  >;