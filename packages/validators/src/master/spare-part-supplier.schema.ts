import { z } from "zod";
const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

export const indianPhone = z
  .string()
  .trim()
  .min(1, "Mobile number is required")
  .regex(
    /^(\+91)?[6-9]\d{9}$/,
    "Enter valid Indian mobile number"
  );
export const sparePartSupplierSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  shopName: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  cityId: z.string(),
  city: z.object({
    id: z.string(),
    name: z.string(),
  }).nullable().optional(),
  contactPerson: z.string().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  mobileNo: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  panNo: z.string().nullable().optional(),
  gstin: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export const createSparePartSupplierSchema = z.object({
  name: z.string().trim().min(1, "Supplier name is required"),

  type: z.string().trim().min(1, "Type is required"),

  shopName: z.string().trim().min(1, "Shop name is required"),

  address: optionalString,

  cityId: z.string().min(1, "City is required"),

  contactPerson: z.string().trim().min(1, "Contact person is required"),

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

  email: z.string().trim().email("Enter valid email").optional().or(z.literal("")),

  panNo: optionalString,

  gstin: optionalString,
});
export const updateSparePartSupplierSchema =
  createSparePartSupplierSchema.partial();