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
   PUMP
------------------------------ */

export const pumpSchema = z.object({
  id: z.string(),

  name: z.string(),
  address: z.string().optional(),

  cityId: z.string(),
  stateId: z.string(),
  country: z.string(),

  contactName: z.string().optional(),
  contactPhone: z.string().optional(),

  rateLastUpdated: z.date().optional(),
  currentDieselRate: z.number().optional(),

  gstIn: z.string().optional(),
  pan: z.string().optional(),

  creditLimit: z.number().optional(),

  accountName: z.string().optional(),
  bankName: z.string().optional(),
  branchIfscCode: z.string().optional(),

  isBlackListed: z.boolean(),

  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createPumpSchema =
  z.object({
    name: z
      .string()
      .trim()
      .min(1, "Pump name is required")
      .max(100),

    address: optionalString,

    cityId: z
      .string()
      .min(1, "Please select city"),

    stateId: z
      .string()
      .min(1, "Please select state"),

    country: z
      .string()
      .trim()
      .min(1, "Country is required"),

    contactName: optionalString,

    contactPhone: optionalString.refine(
      (v) =>
        !v ||
        /^[0-9]{10,15}$/.test(v),
      "Enter valid phone number"
    ),

    rateLastUpdated: optionalDate,

    currentDieselRate:
      optionalNumber("Diesel rate"),

    gstIn: optionalString,

    pan: optionalString,

    creditLimit:
      optionalNumber("Credit limit"),

    accountName: optionalString,

    bankName: optionalString,

    branchIfscCode:
      optionalString,

    isBlackListed:
      z.boolean().default(false),
  });

export const updatePumpSchema =
  createPumpSchema.partial();