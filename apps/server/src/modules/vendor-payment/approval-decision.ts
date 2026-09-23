import type { VendorPaymentType } from "../../../generated/prisma/index.js";

export type VendorPaymentApprovalDecision = "AUTO_APPROVE" | "REQUIRE_APPROVAL";

const parseThresholdPaise = (): bigint | null => {
  const raw = process.env.VENDOR_PAYMENT_APPROVAL_THRESHOLD_PAISE;
  if (!raw) return null;
  try {
    const value = BigInt(raw);
    return value >= 0n ? value : null;
  } catch {
    return null;
  }
};

const hamaliRequiresApproval = (): boolean =>
  process.env.HAMALI_REQUIRES_APPROVAL !== "false";

/**
 * The one approval-decision rule for the whole vendor-payment engine (VP-6
 * calls this "the common approval helper" — built here, minimally, because
 * VP-4's submit endpoint cannot work without it; VP-6 adds reject, the
 * maker-checker self-approval block and the approval queue screen on top).
 *
 *   HAMALI with HAMALI_REQUIRES_APPROVAL=false -> auto-approve.
 *   Otherwise, net <= VENDOR_PAYMENT_APPROVAL_THRESHOLD_PAISE -> auto-approve.
 *   Otherwise -> require approval.
 *
 * A missing or malformed threshold defaults to requiring approval — this
 * never silently auto-approves because a config value was absent or broken.
 */
export function decideVendorPaymentApproval(
  type: VendorPaymentType,
  netPayablePaise: bigint,
): VendorPaymentApprovalDecision {
  if (type === "HAMALI" && !hamaliRequiresApproval()) return "AUTO_APPROVE";

  const threshold = parseThresholdPaise();
  if (threshold !== null && netPayablePaise <= threshold) return "AUTO_APPROVE";

  return "REQUIRE_APPROVAL";
}

/**
 * Maker-checker policy for vendor-payment approval: the creator of a slip
 * cannot approve it themselves. Every slip reaching /approve already
 * required approval by definition (an auto-approved slip never enters
 * PENDING_APPROVAL), so there's no separate "above-threshold" check here —
 * the block applies to any self-approval attempt while the policy is on.
 * Defaults to enabled (fail closed) — an unset or malformed value never
 * silently allows self-approval on a financial posting.
 */
export const vendorPaymentMakerCheckerEnabled = (): boolean =>
  process.env.VENDOR_PAYMENT_MAKER_CHECKER !== "false";
