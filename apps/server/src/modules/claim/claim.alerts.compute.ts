/**
 * C9 — which claims have waited too long, and whether a claim is high-value.
 * Pure (no DB) so the rules are unit-tested.
 */

const DAY_MS = 86_400_000;

export type StaleReminder = {
  /** Whole days in the current status. */
  days: number;
  /** "pending assessment" / "active, not settled" — for the message. */
  statusLabel: string;
};

/**
 * A PENDING claim waits from when it was raised; an ACTIVE one from when it
 * was assessed (`activeSince`, falling back to when it was raised). Null when
 * it's within its limit or not open.
 */
export const staleReminder = (
  claim: { status: string; createdAt: Date; activeSince: Date | null },
  now: Date,
  limits: { pendingDays: number; activeDays: number },
): StaleReminder | null => {
  if (claim.status === "PENDING") {
    const days = Math.floor((now.getTime() - claim.createdAt.getTime()) / DAY_MS);
    return days >= limits.pendingDays ? { days, statusLabel: "pending assessment" } : null;
  }
  if (claim.status === "ACTIVE") {
    const since = claim.activeSince ?? claim.createdAt;
    const days = Math.floor((now.getTime() - since.getTime()) / DAY_MS);
    return days >= limits.activeDays ? { days, statusLabel: "assessed but not settled" } : null;
  }
  return null;
};

/** One reminder per claim per calendar day (UTC): the sweep's dedupe key. */
export const staleDedupeKey = (claimId: string, now: Date) =>
  `claim.stale:${claimId}:${now.toISOString().slice(0, 10)}`;

/** Strictly above the threshold. */
export const isHighValue = (claimedAmountPaise: bigint, thresholdPaise: bigint) =>
  claimedAmountPaise > thresholdPaise;
