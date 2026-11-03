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
