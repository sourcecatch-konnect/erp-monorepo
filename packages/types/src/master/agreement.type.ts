import { z } from "zod";

import {
  agreementSchema,
  createAgreementSchema,
  updateAgreementSchema,
} from "@skerp/validators";

export type Agreement =
  z.infer<
    typeof agreementSchema
  >;
export type AgreementWithRelations = Agreement & {
  company?: {
    id: string;
    name: string;
  };

  client?: {
    id: string;
    name: string;
  };

  city?: {
    id: string;
    name: string;
  };

  branch?: {
    id: string;
    name: string;
  };
};
export type CreateAgreementBody =
  z.output<
    typeof createAgreementSchema
  >;

export type UpdateAgreementBody =
  z.output<
    typeof updateAgreementSchema
  >;

export type CreateAgreementFormInput =
  z.input<
    typeof createAgreementSchema
  >;

export type UpdateAgreementFormInput =
  z.input<
    typeof updateAgreementSchema
  >;