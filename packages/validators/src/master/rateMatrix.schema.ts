import { z } from "zod";

/* -----------------------------
   HELPERS
------------------------------ */

const requiredNumber = (label: string) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => Number(v))
    .refine((v) => !Number.isNaN(v), {
      message: `${label} is required`,
    });

const optionalNumber = (label: string) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (
        v === "" ||
        v === undefined ||
        v === null
      ) {
        return undefined;
      }

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

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) =>
    v ? v : undefined
  );

/* -----------------------------
   RATE MATRIX
------------------------------ */

export const rateMatrixSchema =
  z.object({
    id: z.string(),

    agreementId: z.string(),

    routeId: z.string(),

    rate: z.number(),

    transitDays:
      z.number().optional(),

    remarks:
      z.string().optional(),

    createdAt:
      z.date().optional(),

    updatedAt:
      z.date().optional(),
  });

const rateMatrixFieldsSchema =
  z.object({
    agreementId: z
      .string()
      .min(
        1,
        "Please select agreement"
      ),

    routeId: z
      .string()
      .min(
        1,
        "Please select route"
      ),

    rate:
      requiredNumber(
        "Rate"
      ).refine(
        (v) => v > 0,
        "Rate must be greater than 0"
      ),

    transitDays:
      optionalNumber(
        "Transit days"
      ),

    remarks:
      optionalString,
  });

export const createRateMatrixSchema =
  rateMatrixFieldsSchema;

export const updateRateMatrixSchema =
  rateMatrixFieldsSchema.partial();