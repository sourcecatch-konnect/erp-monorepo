import { companySchema, createCompanySchema, updateCompanySchema } from "@skerp/validators";
import z from "zod";

export type Company = z.infer<typeof companySchema>;

export type CreateCompanyBody = z.output<typeof createCompanySchema>;
export type UpdateCompanyBody = z.output<typeof updateCompanySchema>;

export type CreateCompanyFormInput = z.input<typeof createCompanySchema>;
export type UpdateCompanyFormInput = z.input<typeof updateCompanySchema>;