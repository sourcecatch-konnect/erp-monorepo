import { z } from "zod";

export const billTypeSchema = z.enum(["ROAD", "ROAD_RAIL", "ROAD_GTA"]);
export const billPartyTypeSchema = z.enum(["CONSIGNOR", "CONSIGNEE"]);
export const billChargeMechanismSchema = z.enum([
  "NOT_APPLICABLE",
  "FORWARD_CHARGE",
  "REVERSE_CHARGE",
]);
const optionalReason = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((value) => value || undefined);
const id = z.string().trim().min(1);
const isoDate = z.coerce.date();

export const eligibleClientQuerySchema = z.object({
  branchId: id.optional(),
  billingPartyType: billPartyTypeSchema,
  billType: billTypeSchema,
  cutoffDate: isoDate.optional(),
  search: z.string().trim().optional(),
});

export const eligibleLRQuerySchema = eligibleClientQuerySchema.extend({
  customerId: id,
});

export const evaluateLRBillingSchema = z.object({
  lrIds: z.array(id).min(1).max(250),
});

export const createManualLRChargeSchema = z.object({
  type: z.enum([
    "DETENTION",
    "HAMALI",
    "UNLOADING",
    "TOLL",
    "MULTIPOINT",
    "FREIGHT_ADJUSTMENT",
    "DAMAGE_DEDUCTION",
    "OTHER",
  ]),
  effect: z.enum(["ADDITION", "DEDUCTION"]).default("ADDITION"),
  amountPaise: z.coerce.bigint().positive(),
  description: z.string().trim().max(240).optional(),
  reason: optionalReason,
  isTaxable: z.boolean().default(true),
  sacCode: z.string().trim().max(12).optional(),
});

export const approveLRChargeSchema = z.object({
  approvedAmountPaise: z.coerce.bigint().positive().optional(),
  reason: optionalReason,
});

export const cancelLRChargeSchema = z.object({
  reason: optionalReason,
});

const billDraftFieldsSchema = z.object({
  branchId: id,
  billType: billTypeSchema,
  billingPartyType: billPartyTypeSchema,
  customerId: id,
  // Operator-chosen GST Place of Supply state. Required for GST bill types
  // (Road GTA / Road & Rail); not used for ROAD ("to pay", no GST).
  placeOfSupplyStateId: id.optional(),
  billDate: isoDate,
  billingCutoffDate: isoDate.optional().nullable(),
  dueDate: isoDate.optional().nullable(),
  remarks: z.string().trim().max(1000).optional().nullable(),
  lrChargeIds: z.array(id).min(1).max(500),
});

export const createBillDraftSchema = billDraftFieldsSchema.superRefine(
  (value, ctx) => {
    // GST bill types need a Place of Supply to split CGST+SGST vs IGST.
    if (value.billType !== "ROAD" && !value.placeOfSupplyStateId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["placeOfSupplyStateId"],
        message: "Select a Place of Supply state",
      });
    }
  },
);

export const addBillChargesSchema = z.object({
  lrChargeIds: z.array(id).min(1).max(500),
  version: z.number().int().positive(),
});

export const returnBillToDraftSchema = z.object({
  version: z.number().int().positive(),
  reason: optionalReason,
});

export const updateBillDraftSchema = billDraftFieldsSchema
  .omit({ branchId: true })
  .partial()
  .extend({ version: z.number().int().positive() });

export const transitionBillSchema = z.object({
  reason: optionalReason,
});

export const cancelBillSchema = z.object({
  reason: optionalReason,
});

export const billingTaxRuleSchema = z.object({
  name: z.string().trim().min(2).max(120),
  billType: billTypeSchema,
  chargeMechanism: billChargeMechanismSchema,
  sacCode: z.string().trim().min(2).max(12),
  effectiveFrom: isoDate,
  effectiveTo: isoDate.optional().nullable(),
  cgstRateBps: z.number().int().min(0).max(10000),
  sgstRateBps: z.number().int().min(0).max(10000),
  igstRateBps: z.number().int().min(0).max(10000),
  isActive: z.boolean().default(true),
});

export type EligibleLRQuery = z.infer<typeof eligibleLRQuerySchema>;
export type CreateBillDraftInput = z.infer<typeof createBillDraftSchema>;
export type AddBillChargesInput = z.infer<typeof addBillChargesSchema>;
export type UpdateBillDraftInput = z.infer<typeof updateBillDraftSchema>;
export type BillingTaxRuleInput = z.infer<typeof billingTaxRuleSchema>;
