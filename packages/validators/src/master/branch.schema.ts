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

const optionalEmail = z
  .string()
  .trim()
  .email("Invalid email")
  .optional()
  .or(z.literal(""));

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
  allowReceipt: z.boolean(),

  companyId: z.string(),
  warehouseId: z.string().nullable().optional(),

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
    .min(1, "Branch code is required"),

  shortCode: z
    .string()
    .trim()
    .min(1, "Short code is required"),

  name: z
    .string()
    .trim()
    .min(1, "Branch name is required")
    .max(100, "Branch name cannot exceed 100 characters"),

  cityId: optionalString,

  address: optionalString,

  contactName: optionalString,

  contactPhone: optionalPhone("Contact phone"),

  email: optionalEmail,

  weeklyOffDay: optionalString,

  gstNo: optionalString,

  workingHours: optionalString,

  allowLR: z.boolean().default(false),

  isRailHead: z.boolean().default(false),

  allowReceipt: z.boolean().default(true),

  companyId: z.string().min(1, "Company is required"),

  warehouseId: optionalString,
});

export const updateBranchSchema =
  createBranchSchema.partial();