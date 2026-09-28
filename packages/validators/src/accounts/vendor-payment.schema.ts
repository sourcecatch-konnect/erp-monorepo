import { z } from "zod";
// Reuses the CashPayment-side paymentModeSchema (same PaymentMode enum) —
// no reason to redefine it for vendor-payment disbursements.
import { paymentModeSchema } from "../cash/creditor.schema.js";

export const vendorPaymentTypeSchema = z.enum([
  "TRANSPORTER",
  "HAMALI",
  "LDC_BROKER",
  "JOBCARD",
]);

export const vendorPaymentSourceTypeSchema = z.enum([
  "LR",
  "GRN_HAMALI",
  "RAIL_BRANCH_GRN",
  "VP_LOADING",
]);

export const vendorPaymentStatusSchema = z.enum([
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "PARTIALLY_PAID",
  "PAID",
  "CANCELLED",
]);

const id = z.string().trim().min(1);
const isoDate = z.coerce.date();
const moneyPaise = z.coerce.bigint().nonnegative().default(0n);

/* ------------------------------------------------------------------ */
/* Slip list — GET /vendor-payment/slips filters                       */
/* ------------------------------------------------------------------ */

// Paging (`page`/`size`) is parsed separately by the shared list-query
// parser. `status` takes a comma-separated list so a queue spanning several
// statuses (e.g. APPROVED + PARTIALLY_PAID) is one paged query instead of one
// query per status merged in the browser. `search` is matched in the
// database against the slip number and the vendor's name.
export const vendorPaymentSlipListQuerySchema = z.object({
  type: vendorPaymentTypeSchema.optional(),
  status: z
    .string()
    .optional()
    .transform((value) => {
      const parts = (value ?? "")
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
      return parts.length ? parts : undefined;
    })
    .pipe(z.array(vendorPaymentStatusSchema).optional()),
  search: z.string().trim().max(120).optional(),
});

/* ------------------------------------------------------------------ */
/* Calculators — eligible source documents for a slip draft            */
/* ------------------------------------------------------------------ */

// The eligible-source lists are served in chunks: `size` rows per request, and
// the opaque `cursor` from the previous response's `nextCursor` to continue.
// `search` is matched in the database, so it covers every eligible row — not
// just the chunks already loaded in the browser.
const eligibleChunkParams = {
  search: z.string().trim().max(120).optional(),
  cursor: z.string().trim().max(400).optional(),
  size: z.coerce.number().int().min(1).max(100).default(25),
};

export const eligibleTransporterLRQuerySchema = z.object({
  transportId: id,
  branchId: id.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  ...eligibleChunkParams,
});

export const eligibleHamaliSourceQuerySchema = z.object({
  labourId: id,
  branchId: id.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  ...eligibleChunkParams,
});

/* ------------------------------------------------------------------ */
/* Slip create / update — shared by TRANSPORTER (VP-4) and HAMALI (VP-5) */
/* ------------------------------------------------------------------ */

// Every line carries the full column set regardless of slip type — the
// server only reads the columns relevant to `type` (see calculators/*.ts).
// Client-supplied *Paise fields are prefill only: the server recalculates
// every total from these lines and the source documents before persisting.
export const vendorPaymentSlipLineInputSchema = z.object({
  sourceType: vendorPaymentSourceTypeSchema,
  sourceId: id,
  freightPaise: moneyPaise,
  detentionPaise: moneyPaise,
  advancePaise: moneyPaise,
  commissionPaise: moneyPaise,
  hamaliPaise: moneyPaise,
  tdsPaise: moneyPaise,
  damagePaise: moneyPaise,
  stationeryPaise: moneyPaise,
});

// Basis points (1 bps = 0.01%, 10000 bps = 100%) — same convention as
// BillingTaxRule's cgstRateBps/sgstRateBps/igstRateBps. Keeps the TDS % an
// operator enters on a HAMALI slip as an integer, never a float, all the way
// to the server's roundPaiseByBps.
const rateBps = z.coerce.number().int().min(0).max(10000);

const vendorPaymentSlipFieldsSchema = z.object({
  type: vendorPaymentTypeSchema,
  branchId: id,
  transportId: id.optional(),
  labourId: id.optional(),
  // Required for HAMALI (see refinePayee) — applied uniformly to every
  // line's hamaliPaise via roundPaiseByBps. Unused for TRANSPORTER.
  tdsRateBps: rateBps.optional(),
  lines: z.array(vendorPaymentSlipLineInputSchema).min(1).max(200),
});

const refinePayee = (
  value: z.infer<typeof vendorPaymentSlipFieldsSchema>,
  ctx: z.RefinementCtx,
) => {
  if (value.type === "TRANSPORTER") {
    if (!value.transportId)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["transportId"],
        message: "Select a transporter",
      });
    if (value.labourId)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["labourId"],
        message: "A transporter slip cannot also set labourId",
      });
  } else if (value.type === "HAMALI") {
    if (!value.labourId)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["labourId"],
        message: "Select labour",
      });
    if (value.transportId)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["transportId"],
        message: "A hamali slip cannot also set transportId",
      });
    if (value.tdsRateBps === undefined)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tdsRateBps"],
        message: "Enter a TDS percentage",
      });
  } else {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["type"],
      message: "This vendor payment type is not available yet",
    });
  }
};

export const createVendorPaymentSlipSchema =
  vendorPaymentSlipFieldsSchema.superRefine(refinePayee);

export const updateVendorPaymentSlipSchema = z.object({
  lines: z.array(vendorPaymentSlipLineInputSchema).min(1).max(200),
  tdsRateBps: rateBps.optional(),
  version: z.number().int().positive(),
});

export const submitVendorPaymentSlipSchema = z.object({
  version: z.number().int().positive(),
});

export const approveVendorPaymentSlipSchema = z.object({
  version: z.number().int().positive(),
});

export const rejectVendorPaymentSlipSchema = z.object({
  version: z.number().int().positive(),
  reason: z.string().trim().min(1).max(500),
});

export const cancelVendorPaymentSlipSchema = z.object({
  version: z.number().int().positive(),
  reason: z.string().trim().min(1).max(500),
});

/* ------------------------------------------------------------------ */
/* Disbursement — VP-7 (schema defined here now so VP-4's slip detail   */
/* screens and VP-7's disburse screen share one source of truth)        */
/* ------------------------------------------------------------------ */

export const createVendorPaymentDisbursementSchema = z.object({
  paidPaise: z.coerce.bigint().positive(),
  mode: paymentModeSchema,
  paidAt: isoDate,
  referenceNo: z.string().trim().max(120).optional(),
  fundingLedgerId: id,
  clientRequestId: id,
});

export type VendorPaymentSlipLineInput = z.infer<
  typeof vendorPaymentSlipLineInputSchema
>;
export type CreateVendorPaymentSlipInput = z.infer<
  typeof createVendorPaymentSlipSchema
>;
export type UpdateVendorPaymentSlipInput = z.infer<
  typeof updateVendorPaymentSlipSchema
>;
export type CreateVendorPaymentDisbursementInput = z.infer<
  typeof createVendorPaymentDisbursementSchema
>;
export type VendorPaymentSlipListFilters = z.infer<
  typeof vendorPaymentSlipListQuerySchema
>;
