import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const optionalPhone = (label: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value.replace(/\s+/g, "") : undefined))
    .refine(
      (value) =>
        value === undefined ||
        /^[6-9][0-9]{9}$/.test(value) ||
        /^\+?[1-9][0-9]{7,14}$/.test(value),
      `${label} is not valid`
    );

const optionalDateString = z
  .string()
  .optional()
  .transform((value) => {
    if (!value) return undefined;
    return new Date(value).toISOString();
  });

export const companySchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string().nullable().optional(),
  country: z.string(),
  stateId: z.string().nullable().optional(),
  cityId: z.string().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  establishmentYear: z.string(),
  companyPAN: z.string().nullable().optional(),
  mainLogoPath: z.string().nullable().optional(),
  companyTAN: z.string().nullable().optional(),

  state: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .nullable()
    .optional(),

  city: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .nullable()
    .optional(),

  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const createCompanySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Company name is required")
    .max(100, "Company name cannot exceed 100 characters"),

  address: optionalString,

  country: z
    .string()
    .trim()
    .min(1, "Country is required"),

  stateId: optionalString,

  cityId: optionalString,

  contactPhone: optionalPhone("Contact phone"),

  establishmentYear: optionalDateString.refine(
    (value) => value !== undefined,
    "Establishment year is required"
  ),

  companyPAN: z
    .string()
    .trim()
    .transform((value) => (value ? value.toUpperCase() : undefined))
    .pipe(
      z
        .string()
        .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Enter valid PAN number")
        .optional()
    ),

  companyTAN: z
    .string()
    .trim()
    .transform((value) => (value ? value.toUpperCase() : undefined))
    .pipe(
      z
        .string()
        .regex(/^[A-Z]{4}[0-9]{5}[A-Z]{1}$/, "Enter valid TAN number")
        .optional()
    ),

  mainLogoPath: optionalString,
});

export const updateCompanySchema = createCompanySchema.partial();