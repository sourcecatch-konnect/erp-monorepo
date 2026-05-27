import { z } from "zod";

/* -----------------------------
   HELPERS
------------------------------ */

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

const optionalNumber = (label: string) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === "" || v === null || v === undefined)
        return undefined;

      const num = Number(v);

      return Number.isNaN(num)
        ? undefined
        : num;
    })
    .refine(
      (v) =>
        v === undefined ||
        typeof v === "number",
      {
        message: `${label} must be valid`,
      }
    );

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

  tdsAmount: z.number().optional(),
  tdsRate: z.number().optional(),

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

    pan: optionalString,

    tdsAmount:
      optionalNumber("TDS Amount"),

    tdsRate:
      optionalNumber("TDS Rate"),

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