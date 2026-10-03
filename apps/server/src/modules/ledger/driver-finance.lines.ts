import { BadRequestError } from "../../lib/error.js";
import type { DraftLine } from "./posting.service.js";

/**
 * Pure voucher-line builders for driver finance (salary advance, payout,
 * salary run). No DB access — posting.service resolves the ledger ids and
 * hands them in, so the Dr/Cr shape can be unit-tested on its own.
 */

/**
 * Money handed to a driver (salary advance or payout):
 *   Dr Driver ledger   amount
 *   Cr Cash / Bank     amount
 */
export function buildDriverMoneyOutLines(args: {
  driverLedgerId: string;
  fundingLedgerId: string;
  amountPaise: bigint;
  narration: string;
}): DraftLine[] {
  if (args.amountPaise <= 0n)
    throw new BadRequestError("Amount must be greater than zero");
  if (args.driverLedgerId === args.fundingLedgerId)
    throw new BadRequestError("Driver and funding ledger must be different");

  return [
    {
      ledgerId: args.driverLedgerId,
      debitPaise: args.amountPaise,
      creditPaise: 0n,
      narration: args.narration,
    },
    {
      ledgerId: args.fundingLedgerId,
      debitPaise: 0n,
      creditPaise: args.amountPaise,
      narration: args.narration,
    },
  ];
}

export type SalaryRunPostingLine = {
  driverId: string;
  driverLedgerId: string;
  earnedPaise: bigint;
};

/**
 * One journal for a whole salary run:
 *   Dr Driver Salary Expense   Σ earned
 *   Cr <each driver>           earned
 * A driver who earned nothing (absent all month) gets no line. Throws if
 * nobody earned anything — there is nothing to post.
 */
export function buildSalaryRunLines(args: {
  expenseLedgerId: string;
  narration: string;
  lines: SalaryRunPostingLine[];
}): DraftLine[] {
  const seen = new Set<string>();
  let total = 0n;
  const driverLines: DraftLine[] = [];

  for (const line of args.lines) {
    if (line.earnedPaise < 0n)
      throw new BadRequestError("Earned salary cannot be negative");
    if (seen.has(line.driverId))
      throw new BadRequestError("A driver appears twice in the salary run");
    seen.add(line.driverId);
    if (line.earnedPaise === 0n) continue;

    total += line.earnedPaise;
    driverLines.push({
      ledgerId: line.driverLedgerId,
      debitPaise: 0n,
      creditPaise: line.earnedPaise,
      narration: args.narration,
    });
  }

  if (total === 0n)
    throw new BadRequestError("Nothing to post — no driver earned any salary in this run");

  return [
    {
      ledgerId: args.expenseLedgerId,
      debitPaise: total,
      creditPaise: 0n,
      narration: args.narration,
    },
    ...driverLines,
  ];
}
