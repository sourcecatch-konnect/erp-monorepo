/**
 * The day driver money started being tracked in the ERP (salary advances,
 * "Paid in cash" on log slips, payouts — Driver Lifecycle Phase 2 go-live).
 *
 * Log slips dated before it were settled outside the ERP: their "payable to
 * driver" was handed over in cash but never recorded here, and the accountant
 * corrects that history in Tally. So everything driver-finance shows or checks
 * — the driver's balance, unpaid log slips, the "Paid in cash" button — only
 * looks at activity on or after this date. Old rows are left untouched.
 *
 * Override with DRIVER_FINANCE_START_DATE=YYYY-MM-DD.
 */
const DEFAULT_START_DATE = "2026-10-01";

/**
 * Maker-checker for salary runs: the person who created a run cannot approve
 * it. On unless DRIVER_SALARY_MAKER_CHECKER=false — same fail-closed rule as
 * vendor payments, so a missing setting never allows self-approval of payroll.
 */
export const driverSalaryMakerCheckerEnabled = (): boolean =>
  process.env.DRIVER_SALARY_MAKER_CHECKER !== "false";


/**
 * A salary run can only be approved from the last day of its month (absent
 * days, advances and log slips are all in by then). Testing escape hatch:
 * DRIVER_SALARY_ALLOW_EARLY_APPROVAL=true — off unless set, so a live server
 * never lets a month be approved (and its "Paid in cash" closed) early.
 */
export const driverSalaryEarlyApprovalAllowed = (): boolean =>
  process.env.DRIVER_SALARY_ALLOW_EARLY_APPROVAL === "true";

export function driverFinanceStartDate(): Date {
  const raw = process.env.DRIVER_FINANCE_START_DATE?.trim() || DEFAULT_START_DATE;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00.000Z`) : null;
  if (!date || Number.isNaN(date.getTime())) {
    // A typo must never silently widen the window to all history — fall back
    // to the documented go-live date instead.
    return new Date(`${DEFAULT_START_DATE}T00:00:00.000Z`);
  }
  return date;
}
