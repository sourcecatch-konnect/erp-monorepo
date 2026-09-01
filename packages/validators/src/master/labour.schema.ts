import { z } from "zod";

/* -----------------------------
   HELPERS
------------------------------ */

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

const optionalDate = z
  .string()
  .optional()
  .transform((v) => {
    if (!v) return undefined;

    const date = new Date(v);

    return Number.isNaN(date.getTime())
      ? undefined
      : date;
  });

/* -----------------------------
   LABOUR
------------------------------ */

export const labourSchema = z.object({
  id: z.string(),

  name: z.string(),
  photoPath: z.string().optional(),

  address: z.string().optional(),

  cityId: z.string(),

  contactName: z.string().optional(),
  contactPhone: z.string().optional(),

  mobileNo: z.string().optional(),

  referredBy: z.string().optional(),
  refContactNo: z.string().optional(),

  startDate: z.date().optional(),

  pan: z.string().optional(),

  type: z.enum([
    "Supervisor",
    "Hamal",
    "Mechanic",
  ]),

  branchId: z.string(),

  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createLabourSchema =
  z.object({
    name: z
      .string()
      .trim()
      .min(1, "Name is required")
      .max(
        100,
        "Name cannot exceed 100 characters"
      ),

    photoPath: optionalString,

    address: optionalString,

    cityId: z
      .string()
      .min(1, "Please select city"),

    contactName: optionalString,

    contactPhone: optionalString.refine(
      (v) =>
        !v ||
        /^[0-9]{10,15}$/.test(v),
      "Enter valid phone"
    ),

    mobileNo: optionalString.refine(
      (v) =>
        !v ||
        /^[0-9]{10,15}$/.test(v),
      "Enter valid mobile number"
    ),

    referredBy: optionalString,

    refContactNo: optionalString.refine(
      (v) =>
        !v ||
        /^[0-9]{10,15}$/.test(v),
      "Enter valid contact number"
    ),

    startDate: optionalDate,

    pan: z
          .string()
          .trim()
          .optional()
          .transform((value) => (value ? value.toUpperCase() : undefined))
          .pipe(
            z
              .string()
              .regex(panRegex, "Enter valid PAN, e.g. ABCDE1234F")
              .optional()
          ),

    type: z.enum([
      "Supervisor",
      "Hamal",
      "Mechanic",
    ]),

    branchId: z
      .string()
      .min(1, "Please select branch"),
  });

export const updateLabourSchema =
  createLabourSchema.partial();