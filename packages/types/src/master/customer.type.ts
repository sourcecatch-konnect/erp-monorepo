import { z } from "zod";
import {
  customerSchema,
  createCustomerSchema,
  updateCustomerSchema,
} from "@skerp/validators";

export type Customer = z.infer<typeof customerSchema>;

export type CreateCustomerBody = z.output<typeof createCustomerSchema>;
export type UpdateCustomerBody = z.output<typeof updateCustomerSchema>;

export type CreateCustomerFormInput = z.input<typeof createCustomerSchema>;