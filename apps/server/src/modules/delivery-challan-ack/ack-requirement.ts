/**
 * When a delivery challan must carry an approval before it can be paid.
 *
 * Decision Q8: acknowledgement and approval are mandatory before detention
 * calculation and payment.
 * Decision Q10: challans issued **before** the requirement came in are
 * grandfathered — they were delivered under the old rules and must not be
 * stranded unpayable.
 *
 * Pure and parameterised so it can be unit-tested without a clock, a database
 * or an environment.
 */

/**
 * The cutover, read once from `LDC_ACK_REQUIRED_FROM` (an ISO date).
 *
 * **Unset means "require it of nothing"** — every challan is grandfathered.
 * That is deliberate: this ships dark, so deploying it cannot suddenly block
 * payment of challans already in flight. Operations sets the date when the
 * acknowledgement screens are live and staff are trained, and from that
 * moment new challans need an approval.
 *
 * A malformed value is treated the same as unset rather than throwing on
 * boot: a typo in an env var should not take the server down, and the
 * fail-safe direction here is "do not block payments". The mis-set value is
 * visible because the requirement simply never kicks in.
 */
export const ackRequiredFrom = (
  raw: string | undefined = process.env.LDC_ACK_REQUIRED_FROM,
): Date | null => {
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export type ChallanAckRequirementInput = {
  /** When the challan was issued — `loadingAt` is the challan's own date. */
  issuedAt: Date;
  /** Whether an approval row exists for it. */
  hasApproval: boolean;
};

/**
 * Is this challan allowed onto a payment slip?
 *
 * - Approved → yes, always.
 * - No cutover configured → yes (the requirement is not in force).
 * - Issued before the cutover → yes, grandfathered (Q10).
 * - Issued on or after the cutover, not approved → **no**.
 */
export const isPayableWithoutApproval = (
  input: ChallanAckRequirementInput,
  cutover: Date | null,
): boolean => {
  if (input.hasApproval) return true;
  if (!cutover) return true;
  return input.issuedAt.getTime() < cutover.getTime();
};

/** Why a challan is being held back, for the operator. */
export const approvalRequiredReason =
  "This challan needs a DC approval before the broker can be paid — file the supervisor and broker acknowledgements, then approve one.";
