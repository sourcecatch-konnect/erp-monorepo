import { z } from "zod";

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
