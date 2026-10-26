import { BadRequestError } from "../../lib/error.js";

/**
 * Pure salary-run maths (no DB) — the same columns as the office's monthly
 * salary sheet. All "balance" figures are signed: positive = the driver owes us.
 */

/** Which salary-sheet column a driver-ledger movement belongs to. */
export type MovementBucket =
  /** Money given against salary. */
  | "SALARY_ADVANCE"
  /** A log slip's settlement and any "Paid in cash" against it. */
  | "LOG_SLIP"
  /** An earlier salary run's credit or payment — always "previous balance". */
  | "SALARY"
  /** Anything else (manual payouts, …). */
  | "OTHER";

export type LedgerMovement = {
  voucherDate: Date;
  bucket: MovementBucket;
  /** debit − credit on the driver's ledger: positive = driver owes more. */
  owesPaise: bigint;
};

export type MonthBounds = {
  month: string;
  monthStart: Date;
  /** Exclusive end — the first instant of the next month. */
  nextMonthStart: Date;
  /** Last calendar day of the month (00:00 UTC) — the salary voucher date. */
  monthEnd: Date;
  daysInMonth: number;
};

export function monthBounds(month: string): MonthBounds {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!match) throw new BadRequestError("Month must be YYYY-MM");
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const monthStart = new Date(Date.UTC(year, monthIndex, 1));
  const nextMonthStart = new Date(Date.UTC(year, monthIndex + 1, 1));
  const monthEnd = new Date(Date.UTC(year, monthIndex + 1, 0));
  return { month, monthStart, nextMonthStart, monthEnd, daysInMonth: monthEnd.getUTCDate() };
}

export type PaymentPiece = { driverId: string; sourceIndex: number; amountPaise: bigint };

/**
 * Pay each driver what he is due from the accounts in order, using up one
 * account before moving to the next — so a driver whose pay crosses from one
 * account into the next is paid from both. The accounts must add up exactly
 * to what is due.
 */
export function splitAcrossSources(
  dues: { driverId: string; amountPaise: bigint }[],
  sources: { amountPaise: bigint }[],
): PaymentPiece[] {
  const due = dues.reduce((s, d) => s + d.amountPaise, 0n);
  const available = sources.reduce((s, x) => s + x.amountPaise, 0n);
  if (due !== available)
    throw new BadRequestError(
      `The accounts add up to ₹${(Number(available) / 100).toFixed(2)} but ₹${(Number(due) / 100).toFixed(2)} is due to the selected drivers`,
    );
  const left = sources.map((s) => s.amountPaise);
  const pieces: PaymentPiece[] = [];
  let i = 0;
  for (const d of dues) {
    let need = d.amountPaise;
    while (need > 0n) {
      while (left[i] === 0n) i += 1;
      const take = need < left[i]! ? need : left[i]!;
      pieces.push({ driverId: d.driverId, sourceIndex: i, amountPaise: take });
      left[i] = left[i]! - take;
      need -= take;
    }
  }
  return pieces;
}

/** "2026-11" → "2026-10"; "2027-01" → "2026-12". */
export function previousMonth(month: string): string {
  const { monthStart } = monthBounds(month);
  const prev = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() - 1, 1));
  return prev.toISOString().slice(0, 7);
}

/** Today's calendar date in India, as YYYY-MM-DD. */
export const indiaToday = (now: Date = new Date()) =>
  now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/**
 * The first day a month's salary run may be approved — its last calendar day
 * (YYYY-MM-DD), compared in India time.
 */
export function approvableFrom(month: string): string {
  return monthBounds(month).monthEnd.toISOString().slice(0, 10);
}

export function canApproveMonth(month: string, now: Date = new Date()): boolean {
  return indiaToday(now) >= approvableFrom(month);
}

const dayOf = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Days of the month the driver was employed — from his joining date (if it
 * falls in the month) to his leaving date (if it does), both inclusive.
 * 0 when he joined after the month or left before it. Dates are the calendar
 * days stored by the Driver form (midnight UTC).
 */
export function employedDaysInMonth(
  bounds: MonthBounds,
  joiningDate: Date | null,
  leavingDate: Date | null,
): number {
  const first = dayOf(bounds.monthStart);
  const last = dayOf(bounds.monthEnd);
  const from = joiningDate && dayOf(joiningDate) > first ? dayOf(joiningDate) : first;
  const to = leavingDate && dayOf(leavingDate) < last ? dayOf(leavingDate) : last;
  if (from > to) return 0;
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
}

/**
 * Salary for the days worked, rounded to the nearest rupee — the sheet's
 * "Act/Pble" column: 7,000 × 30 ÷ 31 = 6,774.
 */
export function earnedSalaryPaise(
  baseSalaryPaise: bigint,
  presentDays: number,
  daysInMonth: number,
): bigint {
  if (baseSalaryPaise < 0n) throw new BadRequestError("Salary cannot be negative");
  if (presentDays <= 0) return 0n;
  const numerator = baseSalaryPaise * BigInt(presentDays);
  const denominator = BigInt(daysInMonth) * 100n; // → whole rupees
  const rupees = (numerator * 2n + denominator) / (denominator * 2n); // round half up
  return rupees * 100n;
}

export type SalaryLineInput = {
  baseSalaryPaise: bigint;
  absentDays: number;
  daysInMonth: number;
  /** Days employed this month (joining / leaving date); defaults to the
   *  whole month. Absent days are counted inside these. */
  employedDays?: number;
  /** First instant counted as "this month" — the month start, or the
   *  driver-finance start date when that falls inside the month. */
  windowStart: Date;
  /** Every driver-ledger movement since the driver-finance start date and
   *  before the next month starts, excluding this run's own salary voucher. */
  movements: LedgerMovement[];
  /** Still-unpaid net pay from earlier approved runs. It sits on the ledger as
   *  "we owe", but will be paid from that run — so it is added back here
   *  instead of being paid a second time through this run. */
  outstandingEarlierRunsPaise: bigint;
};

export type SalaryLineResult = {
  presentDays: number;
  earnedPaise: bigint;
  salaryAdvancePaise: bigint;
  logSlipBalancePaise: bigint;
  otherPaymentsPaise: bigint;
  previousBalancePaise: bigint;
  netPaise: bigint;
};

/**
 *   net = earned − (what the driver owes us at month end)
 * and that one ledger figure is split into the sheet's columns: this month's
 * salary advances, log slips and other payments, with everything else
 * (last month's carry, late entries, earlier salaries) as previous balance.
 * The columns always add back up to the ledger figure.
 */
export function computeSalaryLine(input: SalaryLineInput): SalaryLineResult {
  if (!Number.isInteger(input.absentDays) || input.absentDays < 0)
    throw new BadRequestError("Absent days must be a whole number, 0 or more");
  const employedDays = input.employedDays ?? input.daysInMonth;
  if (input.absentDays > employedDays)
    throw new BadRequestError(
      employedDays < input.daysInMonth
        ? `Absent days cannot be more than ${employedDays} — he was employed only ${employedDays} day(s) this month`
        : `Absent days cannot be more than ${input.daysInMonth}`,
    );

  const presentDays = employedDays - input.absentDays;
  const earnedPaise = earnedSalaryPaise(input.baseSalaryPaise, presentDays, input.daysInMonth);

  let owesTotal = input.outstandingEarlierRunsPaise;
  let advance = 0n;
  let logSlip = 0n;
  let other = 0n;
  for (const m of input.movements) {
    owesTotal += m.owesPaise;
    if (m.voucherDate < input.windowStart || m.bucket === "SALARY") continue;
    if (m.bucket === "SALARY_ADVANCE") advance += m.owesPaise;
    else if (m.bucket === "LOG_SLIP") logSlip += m.owesPaise;
    else other += m.owesPaise;
  }
  // A reversal this month of an earlier month's advance would show as a
  // negative advance — keep the column readable and let it fall into the
  // previous balance instead.
  const salaryAdvancePaise = advance > 0n ? advance : 0n;
  const previousBalancePaise = owesTotal - salaryAdvancePaise - logSlip - other;

  return {
    presentDays,
    earnedPaise,
    salaryAdvancePaise,
    logSlipBalancePaise: logSlip,
    otherPaymentsPaise: other,
    previousBalancePaise,
    netPaise: earnedPaise - owesTotal,
  };
}
