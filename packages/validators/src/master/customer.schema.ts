import { z } from "zod";
import { indianPhone } from "./spare-part-supplier.schema.js";
const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));


const optionalNumberField = (message: string) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === "" || value === undefined || value === null) {
        return undefined;
      }
      return Number(value);
    })
    .refine(
      (value) => value === undefined || !Number.isNaN(value),
      message
    );

export const customerSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortName: z.string().nullable().optional(),
  customerPAN: z.string().nullable().optional(),
  disallowNewLRBooking: z.boolean(),
  interestRateLatePayment: z.number().nullable().optional(),
  gstNo: z.string().nullable().optional(),
  creditLimit: z.number().nullable().optional(),
  tdsDeductionRate: z.number().nullable().optional(),

  address: z.string().nullable().optional(),
  country: z.string(),
  stateId: z.string(),
  cityId: z.string(),

  contactPhone: z.string().nullable().optional(),
  primaryEmail: z.string().nullable().optional(),

  contactPerson: z.string().nullable().optional(),
  mobileNo: z.string().nullable().optional(),
  website: z.string().nullable().optional(),

  state: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),

  city: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),

  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export const createCustomerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Customer name is required")
    .max(100, "Customer name cannot exceed 100 characters"),

  shortName: optionalString,

  customerPAN: z
    .string()
    .trim()
    .transform((value) => (value ? value.toUpperCase() : undefined))
    .pipe(
      z
        .string()
        .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Enter valid PAN number")
        .optional()
    ),

  disallowNewLRBooking: z.boolean().default(false),

  interestRateLatePayment: optionalNumberField("Enter valid interest rate")
    .refine(
      (value) => value === undefined || value >= 0,
      "Interest rate cannot be negative"
    ),

  gstNo: z
    .string()
    .trim()
    .transform((value) => (value ? value.toUpperCase() : undefined))
    .pipe(
      z
        .string()
        .regex(
          /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
          "Enter valid GST number"
        )
        .optional()
    ),

  creditLimit: optionalNumberField("Enter valid credit limit")
    .refine(
      (value) => value === undefined || value >= 0,
      "Credit limit cannot be negative"
    ),

  tdsDeductionRate: optionalNumberField("Enter valid TDS rate")
    .refine(
      (value) => value === undefined || value >= 0,
      "TDS rate cannot be negative"
    )
    .refine(
      (value) => value === undefined || value <= 100,
      "TDS rate cannot exceed 100%"
    ),

  address: optionalString,

  country: z
    .string()
    .trim()
    .min(1, "Country is required"),

  stateId: z
    .string()
    .min(1, "State is required"),

  cityId: z
    .string()
    .min(1, "City is required"),


     contactPhone: indianPhone,
    
      mobileNo: z
        .string()
        .trim()
        .optional()
        .or(z.literal(""))
        .refine(
          (value) => !value || /^(\+91)?[6-9]\d{9}$/.test(value),
          "Enter valid Indian mobile number"
        ),
  primaryEmail: z
    .string()
    .trim()
    .email("Enter valid email")
    .optional()
    .or(z.literal("").transform(() => undefined)),

  contactPerson: optionalString,


  website: z
    .string()
    .trim()
    .url("Enter valid website URL")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export const updateCustomerSchema = createCustomerSchema.partial();