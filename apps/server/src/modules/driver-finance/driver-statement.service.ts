import { db } from "../../../prisma/prisma.js";
import { NotFoundError } from "../../lib/error.js";
import { driverFinanceStartDate } from "./driver-finance.config.js";

/**
 * Driver statement (Driver Lifecycle Phase 4) — every voucher on one driver's
 * ledger in date order with a running balance, from the driver-finance start
 * date. Older history was settled outside the ERP (see driver-finance.config).
 *
 * Signed like the rest of driver finance: positive = the driver owes us (Dr),
 * negative = we owe the driver (Cr). Reversed entries (and their reversals)
 * are left out — they cancel out; Driver Payments / Salary Advances list them.
 */

export type DriverStatementKind =
  | "LOG_SLIP"
  | "SALARY_ADVANCE"
  | "PAYMENT"
  | "SALARY"
  | "REVERSAL"
  | "OTHER";

const KIND_BY_SOURCE: Record<string, DriverStatementKind> = {
  LOG_SLIP: "LOG_SLIP",
  DRIVER_SALARY_ADVANCE: "SALARY_ADVANCE",
  DRIVER_PAYOUT: "PAYMENT",
  DRIVER_SALARY: "SALARY",
};

type Range = { from?: string; to?: string };

export async function buildDriverStatement(driverId: string, range: Range = {}) {
  const driver = await db.driver.findUnique({
    where: { id: driverId },
    select: { id: true, name: true, licenseNo: true, licenseExpiryDate: true },
  });
  if (!driver) throw new NotFoundError("Driver not found");

  const startDate = driverFinanceStartDate();
  const empty = {
    driver,
    startDate,
    openingBalancePaise: 0,
    closingBalancePaise: 0,
    totals: { debitPaise: 0, creditPaise: 0 },
    lines: [] as DriverStatementLine[],
  };

  const ledger = await db.ledger.findUnique({ where: { driverId }, select: { id: true } });
  if (!ledger) return empty;

  const fromDate = range.from ? new Date(`${range.from}T00:00:00.000Z`) : null;
  const toDate = range.to ? new Date(`${range.to}T23:59:59.999Z`) : null;

  const rows = await db.journalLine.findMany({
    where: {
      ledgerId: ledger.id,
      journalEntry: {
        // Live vouchers only: a reversed voucher and its reversal cancel out, but
        // the reversal is dated the day it was made — so across the go-live
        // date or a month end one half would be counted alone. Leave both out.
        status: "POSTED",
        reversesId: null,
        voucherDate: { gte: startDate, ...(toDate ? { lte: toDate } : {}) },
      },
    },
    select: {
      id: true,
      debitPaise: true,
      creditPaise: true,
      narration: true,
      journalEntry: {
        select: {
          id: true,
          voucherDate: true,
          voucherNumber: true,
          narration: true,
          sourceType: true,
          sourceId: true,
          createdAt: true,
          reversesId: true,
        },
      },
    },
    orderBy: [
      { journalEntry: { voucherDate: "asc" } },
      { journalEntry: { createdAt: "asc" } },
      { lineNumber: "asc" },
    ],
  });

  // Links: a log slip opens its workbench, a salary its salary run.
  const logSlipIds = rows
    .filter((r) => r.journalEntry.sourceType === "LOG_SLIP")
    .map((r) => r.journalEntry.sourceId);
  const journeyBySlip = new Map(
    (
      await db.logSlip.findMany({
        where: { id: { in: logSlipIds } },
        select: { id: true, journeyId: true },
      })
    ).map((s) => [s.id, s.journeyId]),
  );
  const hrefFor = (je: (typeof rows)[number]["journalEntry"]) => {
    if (je.sourceType === "LOG_SLIP") {
      const journeyId = journeyBySlip.get(je.sourceId);
      return journeyId ? `/vehicle-journeys/${journeyId}/log-slip` : null;
    }
    if (je.sourceType === "DRIVER_SALARY") return `/accounts/driver-salary-runs/${je.sourceId}`;
    return null;
  };

  let running = 0;
  let opening = 0;
  let debit = 0;
  let credit = 0;
  const lines: DriverStatementLine[] = [];
  for (const row of rows) {
    const dr = Number(row.debitPaise);
    const cr = Number(row.creditPaise);
    running += dr - cr;
    const je = row.journalEntry;
    if (fromDate && je.voucherDate < fromDate) {
      opening = running;
      continue;
    }
    debit += dr;
    credit += cr;
    lines.push({
      id: row.id,
      journalEntryId: je.id,
      date: je.voucherDate.toISOString(),
      kind: KIND_BY_SOURCE[je.sourceType ?? ""] ?? "OTHER",
      particulars: row.narration || je.narration || "",
      voucherNumber: je.voucherNumber,
      href: hrefFor(je),
      debitPaise: dr,
      creditPaise: cr,
      runningBalancePaise: running,
    });
  }

  return {
    ...empty,
    openingBalancePaise: opening,
    closingBalancePaise: lines.length ? lines[lines.length - 1]!.runningBalancePaise : opening,
    totals: { debitPaise: debit, creditPaise: credit },
    lines,
  };
}

export type DriverStatementLine = {
  id: string;
  journalEntryId: string;
  date: string;
  kind: DriverStatementKind;
  particulars: string;
  voucherNumber: string | null;
  href: string | null;
  debitPaise: number;
  creditPaise: number;
  runningBalancePaise: number;
};
