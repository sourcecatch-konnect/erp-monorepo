import { z } from "zod";

/* -----------------------------
   HELPERS
------------------------------ */
const today = new Date();
today.setHours(0, 0, 0, 0);

const requiredDate = (label: string) =>
  z
    .string()
    .min(1, `${label} is required`)
    .transform((v) => {
      const date = new Date(v);
      date.setHours(0, 0, 0, 0);
      return date;
    });
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



/* -----------------------------
   AGREEMENT
------------------------------ */

export const agreementSchema =
  z.object({
    id: z.string(),

    companyId: z.string(),

    clientId: z.string(),

    cityId: z.string(),

    startDate: z.date(),

    agreementDate: z.date(),

    expiryDate: z.date(),

    carryingCapacity:
      z.number().optional(),

    leadGeneratedByBranchId:
      z.string(),

    createdAt: z.date(),

    updatedAt: z.date(),
  });

const agreementFieldsSchema =
  z.object({
    companyId: z
      .string()
      .min(1, "Please select company"),

    clientId: z
      .string()
      .min(1, "Please select client"),

    cityId: z
      .string()
      .min(1, "Please select city"),

    startDate:
      requiredDate("Start date"),

    agreementDate:
      requiredDate(
        "Agreement date"
      ),

    expiryDate:
      requiredDate(
        "Expiry date"
      ),

    carryingCapacity:
      optionalNumber(
        "Carrying capacity"
      ),

    leadGeneratedByBranchId:
      z
        .string()
        .min(
          1,
          "Please select branch"
        ),
  });

export const createAgreementSchema = agreementFieldsSchema
  .refine((data) => data.startDate >= today, {
    path: ["startDate"],
    message: "Start date cannot be in the past.",
  })
  .refine((data) => data.expiryDate > today, {
    path: ["expiryDate"],
    message: "Expiry date must be a future date.",
  })
  .refine((data) => data.agreementDate <= today, {
    path: ["agreementDate"],
    message: "Agreement date cannot be in the future.",
  })
  .refine((data) => data.expiryDate > data.startDate, {
    path: ["expiryDate"],
    message: "Expiry date must be later than the start date.",
  });
export const updateAgreementSchema = agreementFieldsSchema
  .partial()
  .refine((data) => !data.startDate || data.startDate >= today, {
    path: ["startDate"],
    message: "Start date cannot be in the past.",
  })
  .refine((data) => !data.agreementDate || data.agreementDate <= today, {
    path: ["agreementDate"],
    message: "Agreement date cannot be in the future.",
  })
  .refine((data) => !data.expiryDate || data.expiryDate > today, {
    path: ["expiryDate"],
    message: "Expiry date must be a future date.",
  })
  .refine(
    (data) => {
      if (data.startDate && data.expiryDate) {
        return data.expiryDate > data.startDate;
      }

      return true;
    },
    {
      path: ["expiryDate"],
      message: "Expiry date must be later than the start date.",
    }
  );