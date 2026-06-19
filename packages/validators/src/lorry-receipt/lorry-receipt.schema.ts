import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

const positiveInt = (label: string) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => Number(v))
    .refine((v) => Number.isInteger(v) && v > 0, `${label} must be a positive whole number`);

const optionalPositiveInt = (label: string) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === "" || v === undefined || v === null) return undefined;
      return Number(v);
    })
    .refine(
      (v) => v === undefined || (Number.isInteger(v) && v > 0),
      `${label} must be a positive whole number`,
    );

const requiredDate = z
  .union([z.string(), z.date()])
  .transform((v) => new Date(v))
  .refine((v) => !Number.isNaN(v.getTime()), "Enter a valid date");

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/*                                                                    */
/* These are shared with the LRGroup schema, which imports them from  */
/* here. Most LR-level facts now live on the group; the LR keeps only */
/* status + the per-invoice bits.                                     */
/* ------------------------------------------------------------------ */

export const lrStatusSchema = z.enum(["DRAFT", "FINALISED", "CANCELLED"]);
export const lrSourceSchema = z.enum(["FROM_ORDER", "INSTANT"]);
export const lrTransportTypeSchema = z.enum(["Road", "Rail", "RoadAndRail"]);
export const lrTripLegTypeSchema = z.enum(["DIRECT", "TO_HUB", "FROM_HUB"]);
export const lrPrioritySchema = z.enum(["Normal", "Express", "Critical"]);

/* ------------------------------------------------------------------ */
/* Goods line                                                          */
/* ------------------------------------------------------------------ */

const optionalDimension = (label: string) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === "" || v === undefined || v === null) return undefined;
      return Number(v);
    })
    .refine(
      (v) => v === undefined || (!Number.isNaN(v) && v >= 0),
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

/* ------------------------------------------------------------------ */
/* Update (DRAFT only)                                                 */
/*                                                                    */
/* An LR is a single consignment within an LRGroup. Only its varying  */
/* bits are editable here: its loading/unloading CustomerLocation,    */
/* goods, and invoice. Parties, branches, transport, vehicle, freight */
/* and seal are edited on the parent group.                           */
/* ------------------------------------------------------------------ */

export const updateLRSchema = z.object({
  loadingLocationId: optionalString,
  unloadingLocationId: optionalString,
  invoiceNumber: optionalString,
  invoiceAmount: optionalPositiveInt("Invoice amount"),
  goods: z.array(lrGoodsLineSchema).min(1, "Add at least one goods line").optional(),
});

export type UpdateLRInput = z.infer<typeof updateLRSchema>;

/* ------------------------------------------------------------------ */
/* Add e-way bill (standalone, for additional eway bills post-create)  */
/* ------------------------------------------------------------------ */

export const ewayBillSchema = z.object({
  ewayBillNo: z.string().trim().min(1, "E-way bill number is required"),
  generatedAt: requiredDate,
  expiresAt: requiredDate,
  generatedBy: optionalString,
  documentUrl: optionalString,
});

export const addEwayBillSchema = ewayBillSchema;

export type AddEwayBillInput = z.infer<typeof addEwayBillSchema>;
