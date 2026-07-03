import { z } from "zod";
import { optionalRupeesToPaise } from "../_shared/money.js";

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const positiveInt = (label: string) =>
  z
    .union([z.string(), z.number()])
    .transform((value) => Number(value))
    .refine(
      (value) => Number.isInteger(value) && value > 0,
      `${label} must be a positive whole number`,
    );

const requiredDate = z
  .union([z.string(), z.date()])
  .transform((value) => new Date(value))
  .refine((value) => !Number.isNaN(value.getTime()), "Enter a valid date");

export const lrStatusSchema = z.enum(["DRAFT", "FINALISED", "CANCELLED"]);
export const lrSourceSchema = z.enum(["FROM_ORDER", "INSTANT"]);
export const lrTransportTypeSchema = z.enum(["Road", "Rail", "RoadAndRail"]);
export const lrTripLegTypeSchema = z.enum(["DIRECT", "TO_HUB", "FROM_HUB"]);
export const lrPrioritySchema = z.enum(["Normal", "Express", "Critical"]);

const optionalDimension = (label: string) =>
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
      (value) => value === undefined || (!Number.isNaN(value) && value >= 0),
      `${label} must be a valid number`,
    );

export const lrGoodsLineSchema = z.object({
  name: z.string().trim().min(1, "Goods name is required").max(100),
  description: optionalString,
  quantity: positiveInt("Quantity"),
  unit: z.string().trim().min(1, "Unit is required").max(20),
  weight: optionalDimension("Weight"),
  length: optionalDimension("Length"),
  width: optionalDimension("Width"),
  height: optionalDimension("Height"),
});

export type LRGoodsLine = z.infer<typeof lrGoodsLineSchema>;

export const updateLRSchema = z.object({
  loadingLocationId: optionalString,
  unloadingLocationId: optionalString,
  invoiceNumber: optionalString,
  invoiceAmount: optionalRupeesToPaise("Invoice amount"),
  goods: z
    .array(lrGoodsLineSchema)
    .min(1, "Add at least one goods line")
    .optional(),
});

export type UpdateLRInput = z.infer<typeof updateLRSchema>;

export const ewayBillSchema = z.object({
  ewayBillNo: z.string().trim().min(1, "E-way bill number is required"),
  generatedAt: requiredDate,
  expiresAt: requiredDate,
  generatedBy: optionalString,
  documentUrl: optionalString,
});

export const addEwayBillSchema = ewayBillSchema;

export type AddEwayBillInput = z.infer<typeof addEwayBillSchema>;
