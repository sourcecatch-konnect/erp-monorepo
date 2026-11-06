/**
 * Settlements above this need a second user with claim.approve (C4). The
 * owner hasn't fixed the limit yet (docs/CLAIMS_JIRA.md, open question 1), so
 * this is a default.
 *
 * Override with CLAIM_SETTLEMENT_APPROVAL_LIMIT_RUPEES (0 = every settlement
 * needs approval). A malformed value falls back to the default, never to
 * "no limit".
 */
const DEFAULT_LIMIT_RUPEES = 25_000;

export const claimSettlementApprovalLimitPaise = (): bigint => {
  const raw = process.env.CLAIM_SETTLEMENT_APPROVAL_LIMIT_RUPEES?.trim();
  const rupees = raw && /^\d+(\.\d{1,2})?$/.test(raw) ? Number(raw) : DEFAULT_LIMIT_RUPEES;
  return BigInt(Math.round(rupees * 100));
};

/* ------------------------------------------------------------------ */
/* C9 — alerts                                                         */
/* ------------------------------------------------------------------ */

const wholeNumber = (raw: string | undefined, fallback: number) => {
  const value = raw?.trim();
  return value && /^\d+$/.test(value) ? Number(value) : fallback;
};

/**
 * A claim still PENDING after this many days (unassessed) or ACTIVE after
 * this many (assessed, not settled) gets a daily reminder to the branch
 * manager. CLAIM_STALE_PENDING_DAYS / CLAIM_STALE_ACTIVE_DAYS; a malformed
 * value falls back to the default.
 */
export const claimStaleLimits = () => ({
  pendingDays: wholeNumber(process.env.CLAIM_STALE_PENDING_DAYS, 7),
  activeDays: wholeNumber(process.env.CLAIM_STALE_ACTIVE_DAYS, 30),
});

/**
 * Claims for more than this alert Admin and Accounts once.
 * CLAIM_HIGH_VALUE_RUPEES, default ₹1,00,000.
 */
export const claimHighValuePaise = (): bigint =>
  BigInt(wholeNumber(process.env.CLAIM_HIGH_VALUE_RUPEES, 100_000)) * 100n;
