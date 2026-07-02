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

const optionalStringId = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v && v.trim() ? v : null));

/* -----------------------------
   RAILWAY FREIGHT MATRIX
------------------------------ */

export const railwayFreightMatrixSchema =
  z.object({
    id: z.string(),

    wagonId: z.string(),

    sourceCityId: z.string(),
    destinationCityId: z.string(),

    sourceAreaId: z.string().nullable().optional(),
    destinationAreaId: z.string().nullable().optional(),

    freightAmount: z.number(),

    createdAt: z.date(),
    updatedAt: z.date(),
  });

const railwayFreightMatrixFieldsSchema =
  z.object({
    wagonId: z
      .string()
      .min(1, "Please select wagon"),

    sourceCityId: z
      .string()
      .min(1, "Please select source city"),

    sourceAreaId: optionalStringId,

    destinationCityId: z
      .string()
      .min(
        1,
        "Please select destination city"
      ),

    destinationAreaId: optionalStringId,

    freightAmount:
      requiredNumber(
        "Freight amount"
      ).refine(
        (v) => v > 0,
        "Freight amount must be greater than 0"
      ),
  });

export const createRailwayFreightMatrixSchema =
  railwayFreightMatrixFieldsSchema.refine(
    (data) =>
      data.sourceCityId !==
      data.destinationCityId,
    {
      path: ["destinationCityId"],
      message:
        "Source and destination city cannot be same",
    }
  );

export const updateRailwayFreightMatrixSchema =
  railwayFreightMatrixFieldsSchema
    .partial()
    .refine(
      (data) => {
        if (
          data.sourceCityId &&
          data.destinationCityId
        ) {
          return (
            data.sourceCityId !==
            data.destinationCityId
          );
        }

        return true;
      },
      {
        path: ["destinationCityId"],
        message:
          "Source and destination city cannot be same",
      }
    );
