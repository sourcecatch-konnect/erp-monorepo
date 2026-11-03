import { z } from "zod";
import { optionalRupeesToPaise, rupeesToPaise } from "../_shared/money.js";
// Same PaymentMode enum the vendor-payment disbursement and driver finance use.
import { paymentModeSchema } from "../cash/creditor.schema.js";

/**
 * Claims / Damage Settlement (docs/CLAIMS_JIRA.md, Epic C). Enums mirror the
 * Prisma enums of the same name. Amounts travel as paise (z.coerce.bigint on
 * input, numbers on output — same as vendor payment / driver finance).
 */

const id = z.string().trim().min(1);

export const claimTypeSchema = z.enum(["DAMAGE", "SHORTAGE", "LOSS"]);

export const claimOriginSchema = z.enum(["LR_ACK", "GRN", "RAIL_BRANCH_GRN", "MANUAL"]);

export const claimCauseSchema = z.enum([
  "TRANSPORTER",
  "LABOUR",
  "RAILWAY",
  "CUSTOMER",
  "DRIVER",
  "INSURED_EVENT",
  "UNKNOWN",
]);

export const claimStatusSchema = z.enum([
  "PENDING",
  "ACTIVE",
  "SETTLED",
  "REJECTED",
  "CANCELLED",
]);

export const claimRecoverySourceSchema = z.enum([
  "INSURANCE",
  "TRANSPORTER",
  "DRIVER",
  "LABOUR",
  "RAILWAY",
  "OTHER",
]);

export const claimRecoveryStatusSchema = z.enum(["FILED", "APPROVED", "RECEIVED", "REJECTED"]);

/** ClaimEvent.eventType — a String column, typed here. */
export const claimEventTypeSchema = z.enum([
  "CREATED",
  "UPDATED",
  "STATUS_CHANGED",
  /** The ack/GRN that raised the claim was edited after assessment. */
  "SOURCE_CHANGED",
  /** A settlement above the approval limit was sent for / declined at approval. */
  "SETTLEMENT_REQUESTED",
  "SETTLEMENT_DECLINED",
  "RECOVERY_ADDED",
  "RECOVERY_STATUS_CHANGED",
  "NOTE",
]);

/** Register filters (paging/search/sort come from the shared list-query parser). */
export const claimListQuerySchema = z.object({
  status: claimStatusSchema.optional(),
  claimType: claimTypeSchema.optional(),
  origin: claimOriginSchema.optional(),
  causedBy: claimCauseSchema.optional(),
  branchId: id.optional(),
  customerId: id.optional(),
  lrId: id.optional(),
  /** Every claim on the LRs of one group — the LR detail page. */
  lrGroupId: id.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

/* ------------------------------------------------------------------ */
/* C4 — manual claim, assessment, settlement                           */
/* Money is entered in rupees and arrives here as paise (numbers).     */
/* ------------------------------------------------------------------ */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

/** Blank counts as 0 — a goods line with nothing damaged or short. */
const quantity = (label: string) =>
  z
    .union([z.string(), z.number()])
    .transform((value) => (value === "" ? 0 : Number(value)))
    .refine((value) => Number.isFinite(value) && value >= 0, `${label} must be 0 or more`);

const version = z.number().int().positive();

/** A form's yyyy-mm-dd string, or a Date. */
const requiredDate = (label: string) =>
  z
    .union([z.string(), z.date()])
    .transform((value) => new Date(value))
    .refine((value) => !Number.isNaN(value.getTime()), `Enter a valid ${label}`);

export const createClaimItemSchema = z.object({
  lrGoodsId: id,
  damagedQty: quantity("Damaged quantity"),
  shortageQty: quantity("Short quantity"),
});

/** A claim raised by hand, e.g. from a customer's letter (origin MANUAL). */
export const createClaimSchema = z
  .object({
    lrId: id,
    claimDate: requiredDate("claim date"),
    claimType: claimTypeSchema,
    /** The LR's consignor or consignee. */
    customerId: id,
    causedBy: claimCauseSchema.optional(),
    goodsValue: optionalRupeesToPaise("Goods value"),
    claimedAmount: rupeesToPaise("Claimed amount"),
    basisDescription: optionalText(1000),
    items: z.array(createClaimItemSchema).min(1, "Pick the goods lines"),
  })
  .superRefine((value, ctx) => {
    if (!value.items.some((item) => item.damagedQty > 0 || item.shortageQty > 0))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items"],
        message: "Enter a damaged or short quantity on at least one goods line",
      });
  });

/**
 * Assess (PENDING → ACTIVE) and later edits of an active claim. Everything
 * settlement needs is required here, so an active claim is always settleable.
 */
export const claimAssessmentSchema = z.object({
  version,
  customerId: id,
  claimType: claimTypeSchema,
  causedBy: claimCauseSchema,
  goodsValue: rupeesToPaise("Goods value"),
  claimedAmount: rupeesToPaise("Claimed amount"),
  basisDescription: optionalText(1000),
});

export const claimSettlementModeSchema = z.enum([
  "RECEIPT_DEDUCTION",
  "CREDIT_NOTE",
  "PAID_SEPARATELY",
]);

const settlementFields = {
  settledAt: requiredDate("settlement date"),
  mode: claimSettlementModeSchema,
  /** RECEIPT_DEDUCTION: the allocation whose damage deduction covers it. */
  receiptAllocationId: id.optional(),
  /** CREDIT_NOTE: a credit note on the customer's bill. */
  creditNoteId: id.optional(),
  /** PAID_SEPARATELY: how and from which cash / bank ledger. */
  paymentMode: paymentModeSchema.optional(),
  fundingLedgerId: id.optional(),
  referenceNo: optionalText(120),
  note: optionalText(500),
};

type SettlementShape = {
  mode: z.infer<typeof claimSettlementModeSchema>;
  receiptAllocationId?: string;
  creditNoteId?: string;
  paymentMode?: z.infer<typeof paymentModeSchema>;
  fundingLedgerId?: string;
};

const requireModeFields = (value: SettlementShape, ctx: z.RefinementCtx) => {
  const need = (path: keyof SettlementShape, message: string) => {
    if (!value[path]) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
  };
  if (value.mode === "RECEIPT_DEDUCTION") need("receiptAllocationId", "Pick the receipt");
  if (value.mode === "CREDIT_NOTE") need("creditNoteId", "Pick the credit note");
  if (value.mode === "PAID_SEPARATELY") {
    need("paymentMode", "Pick how it was paid");
    need("fundingLedgerId", "Pick the cash or bank account");
  }
};

export const settleClaimSchema = z
  .object({ version, settledAmount: rupeesToPaise("Settled amount"), ...settlementFields })
  .superRefine(requireModeFields);

/**
 * A settlement above the approval limit, as stored on Claim.pendingSettlement
 * until a second user approves it. Paise as a number, date as ISO.
 */
export const pendingClaimSettlementSchema = z
  .object({ settledAmountPaise: z.number().int().positive(), ...settlementFields })
  .superRefine(requireModeFields);

export const claimVersionSchema = z.object({ version });

/** Reject, cancel, or decline a settlement. */
export const claimReasonSchema = z.object({
  version,
  reason: z.string().trim().min(3, "Give a reason (at least 3 characters)").max(500),
});
