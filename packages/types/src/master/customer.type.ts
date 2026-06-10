import { z } from "zod";
import {
  customerSchema,
  createCustomerSchema,
  updateCustomerSchema,
  customerLocationSchema,
  createCustomerLocationSchema,
  updateCustomerLocationSchema,
} from "@skerp/validators";

export type Customer = z.infer<typeof customerSchema>;

export type CreateCustomerBody = z.output<typeof createCustomerSchema>;
export type UpdateCustomerBody = z.output<typeof updateCustomerSchema>;

export type CreateCustomerFormInput = z.input<typeof createCustomerSchema>;

export type CustomerLocation = z.infer<typeof customerLocationSchema>;
export type CreateCustomerLocationBody = z.output<
  typeof createCustomerLocationSchema
>;
export type CreateCustomerLocationFormInput = z.input<
  typeof createCustomerLocationSchema
>;
export type UpdateCustomerLocationBody = z.output<
  typeof updateCustomerLocationSchema
>;