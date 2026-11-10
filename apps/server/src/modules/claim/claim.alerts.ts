import { db } from "../../../prisma/prisma.js";
import { publishNotificationEvent } from "../notifications/notification.service.js";
import { claimHighValuePaise, claimStaleLimits } from "./claim.config.js";
import { isHighValue, staleDedupeKey, staleReminder } from "./claim.alerts.compute.js";
import { rupeesText } from "./claim.settle.compute.js";

/**
 * C9 — claim alerts, on top of C2's "new claim" notification:
 *   claim.stale       daily reminder to the branch manager for a claim
 *                     pending > 7 days or active > 30 days (config)
 *   claim.high_value  once, to Admin and Accounts, when a claim's claimed
 *                     amount is above the threshold (config)
 * Both are ordinary (non-critical) rules, so each user can turn them off in
 * Notifications → Preferences, like claim.created.
 */

const DAY_MS = 86_400_000;

/** Every open claim past its limit gets today's reminder (deduped per day). */
export const runClaimStaleSweep = async (now: Date = new Date()): Promise<number> => {
  const limits = claimStaleLimits();
  const pendingCutoff = new Date(now.getTime() - limits.pendingDays * DAY_MS);
  const activeCutoff = new Date(now.getTime() - limits.activeDays * DAY_MS);

  const claims = await db.claim.findMany({
    where: {
      deletedAt: null,
      OR: [
        { status: "PENDING", createdAt: { lte: pendingCutoff } },
        // Narrowed further below by when it was assessed.
        { status: "ACTIVE", createdAt: { lte: activeCutoff } },
      ],
    },
    select: {
      id: true,
      claimNumber: true,
      branchId: true,
      status: true,
      createdAt: true,
      lr: { select: { lrNumber: true } },
      events: {
        where: { toStatus: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  let sent = 0;
  for (const claim of claims) {
    const reminder = staleReminder(
      { status: claim.status, createdAt: claim.createdAt, activeSince: claim.events[0]?.createdAt ?? null },
      now,
      limits,
    );
    if (!reminder) continue;
    await publishNotificationEvent({
      eventType: "claim.stale",
      sourceModule: "claim",
      aggregateType: "Claim",
      aggregateId: claim.id,
      branchId: claim.branchId,
      payload: {
        claimNumber: claim.claimNumber,
        lrNumber: claim.lr.lrNumber,
        statusLabel: reminder.statusLabel,
        days: String(reminder.days),
        linkUrl: `/claims/${claim.id}`,
      },
      // Re-running the sweep the same day (a restart) doesn't repeat it.
      dedupeKey: staleDedupeKey(claim.id, now),
    });
    sent += 1;
  }
  return sent;
};

/** Run shortly after boot, then daily — same as the driver licence sweep. */
export const startClaimStaleSweep = (): void => {
  const run = () =>
    runClaimStaleSweep().catch((error) =>
      console.error("[claims] Stale-claim sweep failed:", error),
    );
  setTimeout(run, 90 * 1000);
  setInterval(run, DAY_MS);
};

/**
 * After a claim is raised or its claimed amount changes. Alerts once per
 * claim (dedupe key). Never throws — an alert must not fail the save.
 */
export const notifyIfHighValueClaim = async (claimId: string, actorId: string | null) => {
  try {
    const claim = await db.claim.findUnique({
      where: { id: claimId },
      select: {
        id: true,
        claimNumber: true,
        branchId: true,
        claimedAmountPaise: true,
        lr: { select: { lrNumber: true } },
      },
    });
    if (!claim || !isHighValue(claim.claimedAmountPaise, claimHighValuePaise())) return;
    await publishNotificationEvent({
      eventType: "claim.high_value",
      sourceModule: "claim",
      aggregateType: "Claim",
      aggregateId: claim.id,
      branchId: claim.branchId,
      actorId,
      payload: {
        claimNumber: claim.claimNumber,
        lrNumber: claim.lr.lrNumber,
        amount: rupeesText(claim.claimedAmountPaise),
        linkUrl: `/claims/${claim.id}`,
      },
      dedupeKey: `claim.high_value:${claim.id}`,
    });
  } catch (error) {
    console.error(`[claims] High-value alert for claim ${claimId} failed`, error);
  }
};
