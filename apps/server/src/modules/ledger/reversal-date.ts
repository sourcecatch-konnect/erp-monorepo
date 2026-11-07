/**
 * Which accounting period a reversal voucher belongs to.
 *
 * ── CONFIRMED 2026-11-06 (Q16) ────────────────────────────────────────────
 * The business confirmed **Option 2**: a reversal is dated the day it is
 * made. The original voucher is left untouched apart from its status, and
 * `reversesId` carries the audit reference back to it.
 *
 * (An earlier provisional build used Option 1 — the original's date — and was
 * corrected here when the decision came back. See
 * `docs/LDC_DECISIONS_AND_REVISED_PLAN.md` §2.1.)
 * ──────────────────────────────────────────────────────────────────────────
 *
 * The defect being fixed is a *contradiction*, independent of which option
 * wins: `reverseJournal` used to post the contra with `voucherDate = today`
 * but `fyCode = original.fyCode`. Cancelling a 25-26 bill in 26-27 produced a
 * voucher dated this year and tagged last year, so a date-filtered report
 * (the Day Book) and an FY-filtered report disagreed about when it happened.
 * Whatever option is chosen, `fyCode` must always be the financial year *of
 * the date on the voucher* — that invariant is what the tests assert.
 *
 * ⚠️ STANDING RULE that follows from Option 2. Because the contra is dated
 * today while the original keeps its own date, the two halves of a reversal
 * pair can fall in different periods — so a report that sums `JournalLine`
 * over a date window can pick up one half alone. Three modules already guard
 * against exactly this, and say so in their own comments:
 *
 *   salary-run.service.ts · driver-statement.service.ts · cash-planning.service.ts
 *   "a reversed voucher and its reversal cancel out, but the reversal is
 *    dated the day it was made — so across the go-live date or a month end
 *    one half would be counted alone. Leave both out."
 *
 * Those guards (`status: POSTED` + `reversesId: null`) are now **permanent by
 * decision, not by accident — do not remove them**, and any new report that
 * aggregates journal lines over a period MUST apply the same filter. This
 * includes the Trial Balance (audit F-1) and the reconcile job (audit P0-4),
 * neither of which is built yet.
 *
 * "Respect closed-period rules" (part of Q16) is not yet enforceable: period
 * close is audit F-7 and does not exist, so nothing is closable and today's
 * date is always valid. When F-7 lands, the open/closed test belongs here —
 * which is why `now` is a parameter rather than read from the clock inside.
 */

import { fyCodeFor } from "../_shared/doc-number.js";

export type ReversalPeriod = {
  voucherDate: Date;
  fyCode: string;
};

export type ReversibleVoucher = {
  voucherDate: Date;
  fyCode: string;
};

/**
 * Option 2 (confirmed): the contra is dated **now**, and its financial year
 * is the one that date falls in. Reported history never moves; the link back
 * to what was reversed is `JournalEntry.reversesId`, not a shared date.
 *
 * `original` is unused today. It stays in the signature because the closed-
 * period rule, when F-7 exists, needs to compare the original's period
 * against the current one — and that must be a change inside this file only.
 */
export const reversalPeriodFor = (
  _original: ReversibleVoucher,
  now: Date,
): ReversalPeriod => ({
  voucherDate: now,
  fyCode: fyCodeFor(now),
});
