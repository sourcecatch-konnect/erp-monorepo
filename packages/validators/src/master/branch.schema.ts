import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const optionalLimitedString = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((value) => (value ? value : undefined));

const optionalEmail = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value.toLowerCase() : undefined))
  .refine(
    (value) =>
      value === undefined ||
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    "Invalid email"
  );

const optionalGstNo = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value.toUpperCase() : undefined))
  .refine(
    (value) =>
      value === undefined ||
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(value),
    "Invalid GST number"
  );

const weeklyOffDaySchema = z
  .enum([
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ])
  .or(z.literal(""))
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
export const branchSchema = z.object({
  id: z.string(),

  branchCode: z.string(),
  shortCode: z.string(),
  name: z.string(),

  cityId: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  contactName: z.string().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  weeklyOffDay: z.string().nullable().optional(),
  gstNo: z.string().nullable().optional(),
  workingHours: z.string().nullable().optional(),

  allowLR: z.boolean(),
  isRailHead: z.boolean(),
  isHeadOffice: z.boolean().optional(),
  allowReceipt: z.boolean(),

  companyId: z.string(),
  warehouseId: z.string().nullable().optional(),
isHeadOffice: z.boolean().default(false),
  company: z
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
    .nullable()
    .optional(),

  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const createBranchSchema = z.object({
  branchCode: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase().replace(/\s+/g, ""))
    .pipe(
      z
        .string()
        .min(1, "Branch code is required")
        .max(20, "Branch code cannot exceed 20 characters")
        .regex(/^[A-Z0-9-]+$/, "Branch code can only contain letters, numbers and -")
    ),

  shortCode: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase().replace(/\s+/g, ""))
    .pipe(
      z
        .string()
        .min(1, "Short code is required")
        .max(10, "Short code cannot exceed 10 characters")
        .regex(/^[A-Z0-9-]+$/, "Short code can only contain letters, numbers and -")
    ),

  name: z
    .string()
    .trim()
    .min(1, "Branch name is required")
    .max(100, "Branch name cannot exceed 100 characters"),

  cityId: optionalString,

  address: optionalLimitedString(250, "Address cannot exceed 250 characters"),

  contactName: optionalLimitedString(
    100,
    "Contact name cannot exceed 100 characters"
  ),

  contactPhone: optionalPhone("Contact phone"),

  email: optionalEmail,

  weeklyOffDay: weeklyOffDaySchema,

  gstNo: optionalGstNo,

  workingHours: optionalLimitedString(
    50,
    "Working hours cannot exceed 50 characters"
  ),

  allowLR: z.boolean().default(false),

  isRailHead: z.boolean().default(false),

  isHeadOffice: z.boolean().default(false),

  allowReceipt: z.boolean().default(true),

  companyId: z.string().min(1, "Company is required"),

  warehouseId: optionalString,
  isHeadOffice: z.boolean().default(false),
});

export const updateBranchSchema =
  createBranchSchema.partial();