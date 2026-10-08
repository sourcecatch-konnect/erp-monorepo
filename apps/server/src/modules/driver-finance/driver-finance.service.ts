import type {
  CreateDriverPayoutInput,
  CreateDriverSalaryAdvanceInput,
} from "@skerp/validators";
import { Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import { BadRequestError, NotFoundError } from "../../lib/error.js";
import { fyCodeFor } from "../_shared/doc-number.js";
import { randomUUID } from "node:crypto";
import {
  getOrCreatePartyLedger,
  postDriverPayout,
  postDriverSalaryAdvance,
  reverseJournal,
} from "../ledger/posting.service.js";
import { getBranchRef, peekBranchRef } from "../branch/branch-ref.cache.js";
import { reserveDriverFinanceNumber } from "./driver-finance.numbers.js";
import { driverFinanceStartDate } from "./driver-finance.config.js";
import { cashLedgerBalance } from "../ledger/opening-balance.service.js";

type Client = typeof db | Prisma.TransactionClient;

const TX_OPTIONS = { timeout: 15000, maxWait: 10000 } as const;

const rupees = (paise: bigint) => `₹${(Number(paise) / 100).toFixed(2)}`;

const isUniqueConflict = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

/** Serialises every money movement for one driver, so two payouts can't both
 *  pass the balance check against the same stale balance. */
export const lockDriver = (tx: Prisma.TransactionClient, driverId: string) =>
  tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`driver-finance:${driverId}`}))`;

/**
 * lockDriver for many drivers in ONE round trip (a salary run has dozens).
 * Same lock keys, taken in ascending key order — COLLATE "C" sorts byte-wise,
 * exactly like JavaScript's default sort, so every multi-driver lock in the
 * app uses one order and two of them can never deadlock.
 */
export const lockDrivers = (tx: Prisma.TransactionClient, driverIds: string[]) => {
  const keys = [...new Set(driverIds)].map((id) => `driver-finance:${id}`);
  if (!keys.length) return Promise.resolve(0);
  return tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtext(key))
    FROM (SELECT key FROM unnest(${keys}::text[]) AS t(key) ORDER BY key COLLATE "C") AS ordered
  `;
};

/** Serialises payments out of one cash / bank account, so two payments can't
 *  both pass the balance check against the same money. Always taken AFTER
 *  the driver lock(s), in a fixed order. */
const lockCashLedger = (tx: Prisma.TransactionClient, ledgerId: string) =>
  tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`cash-ledger:${ledgerId}`}))`;

/** Driver lock then account lock in ONE round trip (same order as always). */
export const lockDriverAndCash = (
  tx: Prisma.TransactionClient,
  driverId: string,
  ledgerId: string,
) =>
  tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`driver-finance:${driverId}`})), pg_advisory_xact_lock(hashtext(${`cash-ledger:${ledgerId}`}))`;

/**
 * Refuse a payment bigger than what the cash / bank account holds in the
 * ERP. The balance includes the account's opening balance (Finance → Opening
 * Balances) — without one it starts at ₹0, so the message says so.
 * `alreadyLocked`: the caller took the account lock (lockDriverAndCash).
 */
export async function assertEnoughMoney(
  tx: Prisma.TransactionClient,
  fundingLedgerId: string,
  amountPaise: bigint,
  { alreadyLocked = false }: { alreadyLocked?: boolean } = {},
) {
  if (!alreadyLocked) await lockCashLedger(tx, fundingLedgerId);

  const balance = await cashLedgerBalance(tx, fundingLedgerId);

  if (amountPaise > balance) {
    const ledger = await tx.ledger.findUnique({
      where: { id: fundingLedgerId },
      select: {
        name: true,
        cashAccount: {
          select: {
            opening: { select: { id: true } },
          },
        },
      },
    });

    const has =
      balance > 0n
        ? `only ${rupees(balance)}`
        : `no money (${rupees(balance)})`;

    const hint = ledger?.cashAccount?.opening
      ? ""
      : " — its opening balance is not set; set it in Finance → Opening Balances";

    throw new BadRequestError(
      `${ledger?.name ?? "This account"} has ${has} in the ERP — ${rupees(amountPaise)} can't be paid from it${hint}`,
    );
  }
}
/** Cash / bank accounts with what each holds now (for the pay screens). */
export async function fundingAccounts() {
  const ledgers = await db.ledger.findMany({
    where: { kind: "GL", group: { in: ["CASH", "BANK"] }, isActive: true },
    select: {
      id: true,
      name: true,
      group: true,
      cashAccount: { select: { opening: { select: { id: true } } } },
    },
    orderBy: [{ group: "asc" }, { name: "asc" }],
  });
  // Every account's balance in ONE grouped query (was one query per account).
  const sums = await db.journalLine.groupBy({
    by: ["ledgerId"],
    where: {
      ledgerId: { in: ledgers.map((l) => l.id) },
      journalEntry: { status: { in: ["POSTED", "REVERSED"] } },
    },
    _sum: { debitPaise: true, creditPaise: true },
  });
  const balanceOf = new Map(
    sums.map((s) => [s.ledgerId, (s._sum.debitPaise ?? 0n) - (s._sum.creditPaise ?? 0n)]),
  );
  return ledgers.map((l) => ({
    id: l.id,
    name: l.name,
    group: l.group as "CASH" | "BANK",
    balancePaise: balanceOf.get(l.id) ?? 0n,
    hasOpeningBalance: Boolean(l.cashAccount?.opening),
  }));
}

/* ------------------------------------------------------------------ */
/* Balance                                                             */
/* ------------------------------------------------------------------ */

/**
 * Signed balance of the driver's party ledger since the driver-finance start
 * date: positive = the driver owes us, negative = we owe the driver. Vouchers
 * dated before the start date are left out — that history was settled outside
 * the ERP (see driver-finance.config.ts).
 *
 * Reversed vouchers and their reversals are left out as a pair — they cancel
 * out, and their dates can fall on different sides of the go-live date.
 */
export async function driverLedgerBalance(client: Client, driverId: string) {
  const startDate = driverFinanceStartDate();
  // ONE round trip: sum the lines of whichever ledger belongs to this driver
  // (was: find the ledger, then sum it).
  const sums = await client.journalLine.aggregate({
    where: {
      ledger: { driverId },
      journalEntry: {
        // Live vouchers only: a reversed voucher and its reversal cancel out, but
        // the reversal is dated the day it was made — so across the go-live
        // date or a month end one half would be counted alone. Leave both out.
        status: "POSTED",
        reversesId: null,
        voucherDate: { gte: startDate },
      },
    },
    _sum: { debitPaise: true, creditPaise: true },
  });
  return {
    balancePaise: (sums._sum.debitPaise ?? 0n) - (sums._sum.creditPaise ?? 0n),
    startDate,
  };
}

/**
 * Driver money dated before the go-live date would be left out of every
 * balance and salary run (they start at the go-live date) — refuse it.
 */
export function assertOnOrAfterStart(date: Date, what: string) {
  const start = driverFinanceStartDate();
  if (date < start)
    throw new BadRequestError(
      `${what} date is before driver payments started in the ERP (${start
        .toISOString()
        .slice(0, 10)}) — record it in Tally instead`,
    );
}

/**
 * Salary that is approved but not yet paid. It sits on the driver's ledger as
 * "we owe", but it is paid with "Pay salaries" on its run — a manual payment
 * must not pay it, or the run would pay it a second time.
 */
export async function unpaidApprovedSalary(client: Client, driverId: string) {
  const lines = await client.driverSalary.findMany({
    where: { driverId, isActive: true, netPaise: { gt: 0 }, run: { status: "APPROVED" } },
    select: { runId: true, netPaise: true, run: { select: { runNumber: true } } },
  });
  if (!lines.length) return { amountPaise: 0n, runNumbers: [] as string[] };
  const paid = await client.driverPayout.groupBy({
    by: ["salaryRunId"],
    where: {
      driverId,
      status: "POSTED",
      source: "SALARY_RUN",
      salaryRunId: { in: lines.map((l) => l.runId) },
    },
    _sum: { amountPaise: true },
  });
  const paidByRun = new Map(paid.map((p) => [p.salaryRunId, p._sum.amountPaise ?? 0n]));
  let amountPaise = 0n;
  const runNumbers: string[] = [];
  for (const line of lines) {
    const left = line.netPaise - (paidByRun.get(line.runId) ?? 0n);
    if (left > 0n) {
      amountPaise += left;
      runNumbers.push(line.run.runNumber);
    }
  }
  return { amountPaise, runNumbers };
}

/**
 * Drivers who have left (leaving date set, today or earlier) but whose
 * account is not settled — they owe us (e.g. an advance never recovered) or
 * we owe them. They are in no later salary run, so without this nobody would
 * notice. Only shows the problem; nothing is posted.
 */
export async function leftDriversWithBalance() {
  const drivers = await db.driver.findMany({
    where: { leavingDate: { not: null, lte: new Date() } },
    select: { id: true, name: true, leavingDate: true },
    orderBy: { leavingDate: "desc" },
  });
  const rows = await Promise.all(
    drivers.map(async (d) => {
      const [{ balancePaise }, salary] = await Promise.all([
        driverLedgerBalance(db, d.id),
        unpaidApprovedSalary(db, d.id),
      ]);
      return {
        driverId: d.id,
        name: d.name,
        leavingDate: d.leavingDate!,
        /** Signed: positive = the driver owes us, negative = we owe him. */
        balancePaise,
        /** Part of "we owe" that is approved salary — paid from its run. */
        salaryDuePaise: salary.amountPaise,
        salaryRuns: salary.runNumbers,
      };
    }),
  );
  return rows.filter((r) => r.balancePaise !== 0n);
}

async function requireDriver(client: Client, driverId: string) {
  const driver = await client.driver.findUnique({
    where: { id: driverId },
    select: { id: true, name: true },
  });
  if (!driver) throw new NotFoundError("Driver not found");
  return driver;
}

/** Cash must come out of a CASH account; bank transfer / UPI / cheque out of
 *  a BANK account — otherwise the books move the wrong account. */
export async function assertFundingMatchesMode(
  client: Client,
  fundingLedgerId: string,
  mode: CreateDriverPayoutInput["mode"],
) {
  const ledger = await client.ledger.findUnique({
    where: { id: fundingLedgerId },
    select: { name: true, group: true },
  });
  if (!ledger) throw new NotFoundError("Cash / bank account not found");
  const needed = mode === "CASH" ? "CASH" : "BANK";
  if (ledger.group !== needed)
    throw new BadRequestError(
      mode === "CASH"
        ? `A cash payment must come from a cash account — ${ledger.name} is a bank account`
        : `A bank, UPI or cheque payment must come from a bank account — ${ledger.name} is not one`,
    );
  return ledger.name;
}

const MODE_LABEL: Record<CreateDriverPayoutInput["mode"], string> = {
  CASH: "Cash",
  BANK: "Bank transfer",
  UPI: "UPI",
  CHEQUE: "Cheque",
};

/** " · paid from ICICI Bank-2382 (Bank transfer)" — appended to narrations so
 *  the driver statement, voucher and Day Book show where the money came from. */
export const paidFromText = (accountName: string, mode: CreateDriverPayoutInput["mode"]) =>
  ` · paid from ${accountName} (${MODE_LABEL[mode]})`;

export async function branchCodeOf(branchId: string) {
  return (await getBranchRef(branchId)).branchCode;
}

/* ------------------------------------------------------------------ */
/* Salary advance                                                      */
/* ------------------------------------------------------------------ */

const namedUser = { select: { id: true, firstName: true, lastName: true } } as const;

/** What the salary-advance screens show for one advance. */
export const salaryAdvanceInclude = {
  driver: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true, branchCode: true } },
  fundingLedger: { select: { id: true, name: true } },
  createdBy: namedUser,
  reversedBy: namedUser,
} satisfies Prisma.DriverSalaryAdvanceInclude;

/**
 * Create a salary advance and post it (Dr Driver / Cr Cash-Bank) in one
 * transaction. A retry with the same clientRequestId returns the first
 * advance. The caller has already checked branch access for `input.branchId`.
 *
 * Every round trip costs ~130 ms against the remote database, so everything
 * that can be read up front is read in ONE parallel step, and the reply is
 * built from those reads instead of reloading the row.
 */
export async function createDriverSalaryAdvance(
  input: CreateDriverSalaryAdvanceInput,
  actorId: string,
) {
  assertOnOrAfterStart(input.paidAt, "Salary advance");
  const fyCode = fyCodeFor(input.paidAt);

  // With the branch code already cached, the number is reserved in the same
  // parallel step. Numbers are gap-tolerant, so one reserved for a request
  // that then fails a check (or is a double-click retry) is just a gap.
  const cachedBranch = peekBranchRef(input.branchId);
  const [prior, driver, accountName, branch, driverLedger, createdBy, earlyNumber] =
    await Promise.all([
      db.driverSalaryAdvance.findUnique({
        where: { clientRequestId: input.clientRequestId },
        include: salaryAdvanceInclude,
      }),
      requireDriver(db, input.driverId),
      assertFundingMatchesMode(db, input.fundingLedgerId, input.mode),
      cachedBranch ?? getBranchRef(input.branchId),
      // Creates the driver's ledger on first use — outside the transaction
      // that's harmless: an unused ledger with no entries.
      getOrCreatePartyLedger(db, { driverId: input.driverId }),
      db.user.findUniqueOrThrow({ where: { id: actorId }, ...namedUser }),
      cachedBranch
        ? reserveDriverFinanceNumber(db, "SALARY_ADVANCE", cachedBranch.branchCode, fyCode)
        : null,
    ]);
  if (prior) return prior;

  const advanceNumber =
    earlyNumber ??
    (await reserveDriverFinanceNumber(db, "SALARY_ADVANCE", branch.branchCode, fyCode));

  // The id is made here so the voucher can point at the advance before the
  // advance row exists — the advance is then written once, already linked.
  const advanceId = randomUUID();

  let created;
  try {
    created = await db.$transaction(async (tx) => {
      await lockDriverAndCash(tx, input.driverId, input.fundingLedgerId);
      await assertEnoughMoney(tx, input.fundingLedgerId, input.amountPaise, { alreadyLocked: true });

      const journal = await postDriverSalaryAdvance(tx, {
        sourceId: advanceId,
        voucherNumber: advanceNumber,
        driverId: input.driverId,
        branchId: input.branchId,
        fyCode,
        paidAt: input.paidAt,
        fundingLedgerId: input.fundingLedgerId,
        fundingLedgerChecked: true,
        driverLedgerId: driverLedger.id,
        amountPaise: input.amountPaise,
        narration: `Salary advance ${advanceNumber} — ${driver.name}${paidFromText(accountName, input.mode)}`,
        createdById: actorId,
      });

      return tx.driverSalaryAdvance.create({
        data: {
          id: advanceId,
          advanceNumber,
          driverId: input.driverId,
          branchId: input.branchId,
          fyCode,
          amountPaise: input.amountPaise,
          paidAt: input.paidAt,
          mode: input.mode,
          referenceNo: input.referenceNo ?? null,
          reason: input.reason ?? null,
          fundingLedgerId: input.fundingLedgerId,
          clientRequestId: input.clientRequestId,
          journalEntryId: journal.id,
          createdById: actorId,
        },
      });
    }, TX_OPTIONS);
  } catch (err) {
    // A concurrent identical request won the clientRequestId race; its
    // transaction committed and ours rolled back entirely (voucher included).
    // Re-read OUTSIDE the failed transaction — Postgres refuses any query in
    // a transaction after an error.
    if (isUniqueConflict(err)) {
      const already = await db.driverSalaryAdvance.findUnique({
        where: { clientRequestId: input.clientRequestId },
        include: salaryAdvanceInclude,
      });
      if (already) return already;
    }
    throw err;
  }

  return {
    ...created,
    driver: { id: driver.id, name: driver.name },
    branch: { id: branch.id, name: branch.name, branchCode: branch.branchCode },
    fundingLedger: { id: input.fundingLedgerId, name: accountName },
    createdBy,
    reversedBy: null,
  };
}
export async function reverseDriverSalaryAdvance(
  id: string,
  reason: string,
  actorId: string,
  driverId: string,
) {
  return db.$transaction(async (tx) => {
    await lockDriver(tx, driverId);

    const fresh = await tx.driverSalaryAdvance.findUniqueOrThrow({
      where: { id },
      select: {
        driverId: true,
        status: true,
        journalEntryId: true,
      },
    });

    if (fresh.driverId !== driverId) {
      throw new BadRequestError("Driver changed; retry the reversal");
    }

    if (fresh.status === "REVERSED") {
      throw new BadRequestError("This salary advance is already reversed");
    }

    if (fresh.journalEntryId) {
      await reverseJournal(tx, fresh.journalEntryId, reason, actorId);
    }

    return tx.driverSalaryAdvance.update({
      where: { id },
      data: {
        status: "REVERSED",
        reversedById: actorId,
        reversedAt: new Date(),
        reverseReason: reason,
      },
    });
  });
}
/* ------------------------------------------------------------------ */
/* Log slip payout status                                              */
/* ------------------------------------------------------------------ */

// Only a log slip posted to accounts has credited the driver's ledger with
// its payable — paying one that isn't posted would leave the ledger short.
const PAYABLE_LOG_SLIP_STATUSES = ["POSTED_TO_ACCOUNTS", "TALLY_SYNCED"] as const;

/**
 * How much of a log slip's "we owe the driver" amount is still unpaid. A log
 * slip dated before the driver-finance start date was settled outside the ERP:
 * it reports `settledBeforeStart` and nothing remaining, so it can't be paid
 * again from here.
 */
export async function logSlipPayoutStatus(client: Client, logSlipId: string) {
  const startDate = driverFinanceStartDate();
  const slip = await client.logSlip.findUnique({
    where: { id: logSlipId },
    select: {
      id: true,
      logSlipNumber: true,
      logSlipDate: true,
      status: true,
      driverId: true,
      driverPayablePaise: true,
      driver: { select: { id: true, name: true } },
      journey: { select: { homeBranchId: true } },
    },
  });
  if (!slip) throw new NotFoundError("Log slip not found");

  const payouts = await client.driverPayout.findMany({
    where: { logSlipId, status: "POSTED" },
    select: {
      id: true,
      payoutNumber: true,
      amountPaise: true,
      paidAt: true,
      mode: true,
      journalEntryId: true,
    },
    orderBy: { paidAt: "asc" },
  });
  const paidPaise = payouts.reduce((sum, p) => sum + p.amountPaise, 0n);
  const settledBeforeStart = slip.logSlipDate < startDate;

  // An approved salary run for this month (or later) already counted this log
  // slip in the driver's net pay — paying it in cash now would pay it twice.
  const salaryLine = settledBeforeStart
    ? null
    : await client.driverSalary.findFirst({
      where: {
        driverId: slip.driverId,
        isActive: true,
        month: { gte: slip.logSlipDate.toISOString().slice(0, 7) },
        run: { status: { in: ["APPROVED", "PAID"] } },
      },
      select: { run: { select: { id: true, runNumber: true, month: true } } },
      orderBy: { month: "asc" },
    });
  const settledBySalaryRun = salaryLine?.run ?? null;

  const remaining =
    settledBeforeStart || settledBySalaryRun ? 0n : slip.driverPayablePaise - paidPaise;

  return {
    logSlipId: slip.id,
    logSlipNumber: slip.logSlipNumber,
    logSlipDate: slip.logSlipDate,
    status: slip.status,
    driver: slip.driver,
    branchId: slip.journey.homeBranchId,
    postedToAccounts: (PAYABLE_LOG_SLIP_STATUSES as readonly string[]).includes(slip.status),
    settledBeforeStart,
    startDate,
    settledBySalaryRun,
    payablePaise: slip.driverPayablePaise,
    paidPaise,
    remainingPaise: remaining > 0n ? remaining : 0n,
    payouts,
  };
}

/**
 * The driver's most recent posted log slips that still show money owed to
 * him — shown in the manual Pay dialog so the office pays those from the log
 * slip ("Paid in cash") and the log slip is marked paid, instead of paying
 * them as an unlinked manual payment.
 */
export async function unpaidLogSlipsForDriver(client: Client, driverId: string, limit = 5) {
  const slips = await client.logSlip.findMany({
    where: {
      driverId,
      status: { in: [...PAYABLE_LOG_SLIP_STATUSES] },
      driverPayablePaise: { gt: 0 },
      // Older log slips were settled outside the ERP — never list them.
      logSlipDate: { gte: driverFinanceStartDate() },
    },
    select: {
      id: true,
      logSlipNumber: true,
      journeyId: true,
      logSlipDate: true,
      driverPayablePaise: true,
      driverPayouts: { where: { status: "POSTED" }, select: { amountPaise: true } },
    },
    orderBy: { logSlipDate: "desc" },
    take: 50,
  });
  // Months already covered by an approved salary run were settled through it.
  const lastSettled = await client.driverSalary.findFirst({
    where: { driverId, isActive: true, run: { status: { in: ["APPROVED", "PAID"] } } },
    select: { month: true },
    orderBy: { month: "desc" },
  });
  const unpaid = slips
    .filter((slip) => !lastSettled || slip.logSlipDate.toISOString().slice(0, 7) > lastSettled.month)
    .map((slip) => ({
      id: slip.id,
      logSlipNumber: slip.logSlipNumber,
      journeyId: slip.journeyId,
      logSlipDate: slip.logSlipDate,
      remainingPaise:
        slip.driverPayablePaise - slip.driverPayouts.reduce((sum, p) => sum + p.amountPaise, 0n),
    }))
    .filter((slip) => slip.remainingPaise > 0n);
  return { items: unpaid.slice(0, limit), count: unpaid.length };
}

/* ------------------------------------------------------------------ */
/* Payout                                                              */
/* ------------------------------------------------------------------ */

/**
 * Pay a driver and post it (Dr Driver / Cr Cash-Bank) in one transaction.
 *   LOG_SLIP — capped at the log slip's unpaid payable; branch = the
 *              journey's home branch.
 *   MANUAL   — capped at what the driver's ledger says we owe him since the
 *              driver-finance start date; the caller has already checked
 *              branch access for input.branchId.
 * A retry with the same clientRequestId returns the first payout.
 */
export async function createDriverPayout(input: CreateDriverPayoutInput, actorId: string) {
  const prior = await db.driverPayout.findUnique({
    where: { clientRequestId: input.clientRequestId },
  });
  if (prior) return prior;

  const driver = await requireDriver(db, input.driverId);
  assertOnOrAfterStart(input.paidAt, "Payment");
  const accountName = await assertFundingMatchesMode(db, input.fundingLedgerId, input.mode);

  let branchId: string;
  if (input.source === "LOG_SLIP") {
    const status = await logSlipPayoutStatus(db, input.logSlipId!);
    if (status.driver.id !== input.driverId)
      throw new BadRequestError("This log slip belongs to a different driver");
    branchId = status.branchId;
  } else {
    branchId = input.branchId!;
  }

  const fyCode = fyCodeFor(input.paidAt);
  const payoutNumber = await reserveDriverFinanceNumber(
    db,
    "PAYOUT",
    await branchCodeOf(branchId),
    fyCode,
  );

  return db.$transaction(async (tx) => {
    await lockDriver(tx, input.driverId);

    // Re-check the cap after taking the lock — a concurrent payout may have
    // just used part of it.
    if (input.source === "LOG_SLIP") {
      const status = await logSlipPayoutStatus(tx, input.logSlipId!);
      if (status.settledBeforeStart)
        throw new BadRequestError(
          `This log slip is dated before ${status.startDate.toISOString().slice(0, 10)} and was settled outside the ERP — it can't be paid again here`,
        );
      if (status.settledBySalaryRun)
        throw new BadRequestError(
          `This log slip is already settled in salary run ${status.settledBySalaryRun.runNumber} — it can't be paid again here`,
        );
      if (!status.postedToAccounts)
        throw new BadRequestError("Post the log slip to accounts before paying the driver");
      if (status.remainingPaise <= 0n)
        throw new BadRequestError("Nothing left to pay on this log slip");
      if (input.amountPaise > status.remainingPaise)
        throw new BadRequestError(
          `Only ${rupees(status.remainingPaise)} is still unpaid on this log slip`,
        );
    } else {
      const { balancePaise } = await driverLedgerBalance(tx, input.driverId);
      const owedPaise = balancePaise < 0n ? -balancePaise : 0n;
      const salary = await unpaidApprovedSalary(tx, input.driverId);
      const payablePaise = owedPaise > salary.amountPaise ? owedPaise - salary.amountPaise : 0n;
      const salaryNote = salary.amountPaise
        ? ` — ${rupees(salary.amountPaise)} is approved salary, pay it with "Pay salaries" on ${salary.runNumbers.join(", ")}`
        : "";
      if (payablePaise === 0n)
        throw new BadRequestError(`Nothing can be paid to ${driver.name} here${salaryNote}`);
      if (input.amountPaise > payablePaise)
        throw new BadRequestError(
          `Only ${rupees(payablePaise)} can be paid to ${driver.name} here${salaryNote}`,
        );
    }

    await assertEnoughMoney(tx, input.fundingLedgerId, input.amountPaise);

    let payout;
    try {
      payout = await tx.driverPayout.create({
        data: {
          payoutNumber,
          driverId: input.driverId,
          branchId,
          fyCode,
          source: input.source,
          logSlipId: input.source === "LOG_SLIP" ? input.logSlipId! : null,
          amountPaise: input.amountPaise,
          paidAt: input.paidAt,
          mode: input.mode,
          referenceNo: input.referenceNo ?? null,
          fundingLedgerId: input.fundingLedgerId,
          clientRequestId: input.clientRequestId,
          createdById: actorId,
        },
      });
    } catch (err) {
      if (isUniqueConflict(err)) {
        const already = await tx.driverPayout.findUnique({
          where: { clientRequestId: input.clientRequestId },
        });
        if (already) return already;
      }
      throw err;
    }

    const journal = await postDriverPayout(tx, {
      sourceId: payout.id,
      voucherNumber: payoutNumber,
      driverId: input.driverId,
      branchId,
      fyCode,
      paidAt: input.paidAt,
      fundingLedgerId: input.fundingLedgerId,
      amountPaise: input.amountPaise,
      narration:
        (input.source === "LOG_SLIP"
          ? `Log slip balance paid ${payoutNumber} — ${driver.name}`
          : `Driver payment ${payoutNumber} — ${driver.name}`) +
        paidFromText(accountName, input.mode),
      createdById: actorId,
    });

    return tx.driverPayout.update({
      where: { id: payout.id },
      data: { journalEntryId: journal.id },
    });
  }, TX_OPTIONS);
}

/**
 * Undo a wrong payout with a contra voucher. A salary-run payout also gives
 * the amount back to its run (PAID → APPROVED).
 */
export async function reverseDriverPayout(id: string, reason: string, actorId: string) {
  return db.$transaction(async (tx) => {
    const payout = await tx.driverPayout.findUnique({ where: { id } });
    if (!payout) throw new NotFoundError("Payment not found");
    await lockDriver(tx, payout.driverId);

    const fresh = await tx.driverPayout.findUniqueOrThrow({ where: { id } });
    if (fresh.status === "REVERSED")
      throw new BadRequestError("This payment is already reversed");
    if (fresh.journalEntryId)
      await reverseJournal(tx, fresh.journalEntryId, reason, actorId);

    if (fresh.salaryRunId) {
      await tx.driverSalaryRun.update({
        where: { id: fresh.salaryRunId },
        data: {
          paidPaise: { decrement: fresh.amountPaise },
          status: "APPROVED",
          version: { increment: 1 },
        },
      });
    }

    return tx.driverPayout.update({
      where: { id },
      data: {
        status: "REVERSED",
        reversedById: actorId,
        reversedAt: new Date(),
        reverseReason: reason,
      },
    });
  }, TX_OPTIONS);
}
