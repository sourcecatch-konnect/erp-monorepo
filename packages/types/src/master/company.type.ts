import { companySchema, createCompanySchema, updateCompanySchema } from "@skerp/validators";
import z from "zod";

export type Company = z.infer<typeof companySchema>;
export type CompanyWithRelations = Company & {
  agreements?: Array<{
    id: string;
    startDate: Date;
    agreementDate: Date;
    expiryDate: Date;
    carryingCapacity?: number | null;
    client?: { id: string; name: string };
    city?: { id: string; name: string };
    branch?: { id: string; name: string };
    RateMatrix?: Array<{
      id: string;
      rate: number;
      transitDays?: number | null;
      remarks?: string | null;
      route?: {
        id: string;
        sourceCity?: { id: string; name: string };
        destinationCity?: { id: string; name: string };
      };
    }>;
  }>;
};
export type CreateCompanyBody = z.output<typeof createCompanySchema>;
export type UpdateCompanyBody = z.output<typeof updateCompanySchema>;

export type CreateCompanyFormInput = z.input<typeof createCompanySchema>;
export type UpdateCompanyFormInput = z.input<typeof updateCompanySchema>;