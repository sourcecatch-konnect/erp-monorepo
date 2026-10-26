import type {
  CreateDriverSalaryRunInput,
  PayDriverSalaryRunInput,
  UpdateDriverSalaryRunInput,
} from "@skerp/validators";
import { Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../lib/error.js";
import { fyCodeFor } from "../_shared/doc-number.js";
import {
  postDriverPayout,
  postDriverSalaryRun,
  reverseJournal,
} from "../ledger/posting.service.js";
import { reserveDriverFinanceNumber } from "./driver-finance.numbers.js";
import { overlapMs } from "./driver-salary-allocation.compute.js";
import {
  driverFinanceStartDate,
  driverSalaryEarlyApprovalAllowed,
  driverSalaryMakerCheckerEnabled,
} from "./driver-finance.config.js";
import {
  assertEnoughMoney,
  assertFundingMatchesMode,
  assertOnOrAfterStart,
  paidFromText,
  branchCodeOf,
  lockDrivers,
} from "./driver-finance.service.js";
import {
  approvableFrom,
  canApproveMonth,
  computeSalaryLine,
  employedDaysInMonth,
  splitAcrossSources,
  monthBounds,
  previousMonth,
  type LedgerMovement,
  type MonthBounds,
  type MovementBucket,
} from "./salary-run.compute.js";

/**
 * Driver salary run (Driver Lifecycle Phase 3) — the office's monthly salary
 * sheet inside the ERP. Generate a month for every driver with a salary,
 * type absent days, approve (posts Dr Salary Expense / Cr each driver), pay.
 * The maths lives in salary-run.compute.ts; this file feeds it ledger data.
 */

type Client = typeof db | Prisma.TransactionClient;

// A run touches every driver — give the transaction room.
const TX_OPTIONS = { timeout: 60000, maxWait: 10000 } as const;

const isUniqueConflict = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

const conflict = () =>
  new BadRequestError("This salary run changed in another session. Refresh and try again.");

export const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00.000Z`).toLocaleString("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

/** "This month" starts at the month start, or at the driver-finance start
 *  date when that falls inside the month. */
const windowStartFor = (bounds: MonthBounds) => {
  const start = driverFinanceStartDate();
  return bounds.monthStart > start ? bounds.monthStart : start;
};

function assertMonthAllowed(bounds: MonthBounds) {
  const start = driverFinanceStartDate();
  if (bounds.monthEnd < start)
    throw new BadRequestError(
      `${monthLabel(bounds.month)} is before driver payments started in the ERP (${start
        .toISOString()
        .slice(0, 10)}) — that salary was settled outside the ERP`,
    );
}

/**
 * Months must go in order. Each run reads "everything up to its month end",
 * so a run made for an earlier month after a later one is approved would
 * count the same advances / log slips / payments a second time.
 *   create  — refused when a LATER month is already approved or paid.
 *   approve — refused until the PREVIOUS month is approved or paid (the
 *             go-live month is the first, so it needs nothing before it).
 */
async function assertNoLaterApprovedRun(month: string) {
  const later = await db.driverSalaryRun.findFirst({
    where: { month: { gt: month }, status: { in: ["APPROVED", "PAID"] } },
    select: { month: true, runNumber: true },
    orderBy: { month: "desc" },
  });
  if (later)
    throw new BadRequestError(
      `${monthLabel(later.month)} salary is already approved (${later.runNumber}) — salary runs go in month order. To redo ${monthLabel(month)}, cancel the later runs first.`,
    );
}

async function assertPreviousMonthApproved(month: string) {
  const prev = previousMonth(month);
  // The go-live month has no ERP month before it.
  if (monthBounds(prev).monthEnd < driverFinanceStartDate()) return;
  const prevRun = await db.driverSalaryRun.findFirst({
    where: { month: prev, status: { in: ["APPROVED", "PAID"] } },
    select: { id: true },
  });
  if (!prevRun)
    throw new BadRequestError(
      `Approve the ${monthLabel(prev)} salary run first — salary runs are approved in month order`,
    );
}

/* ------------------------------------------------------------------ */
/* Ledger data for the compute                                         */
/* ------------------------------------------------------------------ */

/**
 * Every movement on these drivers' ledgers from the driver-finance start date
 * up to the end of the month, bucketed into the salary sheet's columns.
 * Reversed vouchers and their reversals are left out as a pair, and so is the
 * run's own salary voucher.
 */
async function loadMovements(
  client: Client,
  driverIds: string[],
  bounds: MonthBounds,
  runId: string | null,
): Promise<Map<string, LedgerMovement[]>> {
  const result = new Map<string, LedgerMovement[]>(driverIds.map((id) => [id, []]));
  const ledgers = await client.ledger.findMany({
    where: { driverId: { in: driverIds } },
    select: { id: true, driverId: true },
  });
  if (!ledgers.length) return result;
  const driverByLedger = new Map(ledgers.map((l) => [l.id, l.driverId!]));

  const lines = await client.journalLine.findMany({
    where: {
      ledgerId: { in: [...driverByLedger.keys()] },
      journalEntry: {
        // Live vouchers only: a reversed voucher and its reversal cancel out, but
        // the reversal is dated the day it was made — so across the go-live
        // date or a month end one half would be counted alone. Leave both out.
        status: "POSTED",
        reversesId: null,
        voucherDate: { gte: driverFinanceStartDate(), lt: bounds.nextMonthStart },
      },
    },
    select: {
      ledgerId: true,
      debitPaise: true,
      creditPaise: true,
      journalEntry: {
        select: {
          voucherDate: true,
          sourceType: true,
          sourceId: true,
        },
      },
    },
  });

  // A payout's column depends on what it paid (log slip / salary / manual).
  const payoutIds = [
    ...new Set(
      lines
        .map((l) => l.journalEntry)
        .filter((s) => s.sourceType === "DRIVER_PAYOUT")
        .map((s) => s.sourceId),
    ),
  ];
  const payoutSource = new Map(
    (
      await client.driverPayout.findMany({
        where: { id: { in: payoutIds } },
        select: { id: true, source: true },
      })
    ).map((p) => [p.id, p.source]),
  );

  for (const line of lines) {
    const source = line.journalEntry;
    if (source.sourceType === "DRIVER_SALARY" && source.sourceId === runId) continue;

    let bucket: MovementBucket;
    switch (source.sourceType) {
      case "DRIVER_SALARY_ADVANCE":
        bucket = "SALARY_ADVANCE";
        break;
      case "LOG_SLIP":
        bucket = "LOG_SLIP";
        break;
      case "DRIVER_SALARY":
        bucket = "SALARY";
        break;
      case "DRIVER_PAYOUT": {
        const paid = payoutSource.get(source.sourceId);
        bucket = paid === "LOG_SLIP" ? "LOG_SLIP" : paid === "SALARY_RUN" ? "SALARY" : "OTHER";
        break;
      }
      default:
        bucket = "OTHER";
    }
    result.get(driverByLedger.get(line.ledgerId)!)!.push({
      voucherDate: line.journalEntry.voucherDate,
      bucket,
      owesPaise: line.debitPaise - line.creditPaise,
    });
  }
  return result;
}

/** What each salary-run payout has paid so far, per (run, driver). */
async function paidPerDriver(client: Client, runIds: string[], driverIds?: string[]) {
  const rows = await client.driverPayout.groupBy({
    by: ["salaryRunId", "driverId"],
    where: {
      status: "POSTED",
      source: "SALARY_RUN",
      salaryRunId: { in: runIds },
      ...(driverIds ? { driverId: { in: driverIds } } : {}),
    },
    _sum: { amountPaise: true },
  });
  return new Map(
    rows.map((r) => [`${r.salaryRunId}:${r.driverId}`, r._sum.amountPaise ?? 0n]),
  );
}

/** Net pay of earlier approved-but-unpaid runs, per driver — paid from those
 *  runs, so not paid again through this one. */
async function outstandingEarlierRuns(client: Client, driverIds: string[], month: string) {
  const rows = await client.driverSalary.findMany({
    where: {
      driverId: { in: driverIds },
      isActive: true,
      month: { lt: month },
      run: { status: "APPROVED" },
    },
    select: { runId: true, driverId: true, netPaise: true },
  });
  const paid = await paidPerDriver(
    client,
    [...new Set(rows.map((r) => r.runId))],
    driverIds,
  );
  const result = new Map<string, bigint>();
  for (const row of rows) {
    if (row.netPaise <= 0n) continue;
    const left = row.netPaise - (paid.get(`${row.runId}:${row.driverId}`) ?? 0n);
    if (left > 0n) result.set(row.driverId, (result.get(row.driverId) ?? 0n) + left);
  }
  return result;
}

type LineInput = {
  driverId: string;
  baseSalaryPaise: bigint;
  absentDays: number;
  remarks: string | null;
};

async function computeLines(
  client: Client,
  bounds: MonthBounds,
  runId: string | null,
  inputs: LineInput[],
) {
  const driverIds = inputs.map((l) => l.driverId);
  const [movements, outstanding, employment] = await Promise.all([
    loadMovements(client, driverIds, bounds, runId),
    outstandingEarlierRuns(client, driverIds, bounds.month),
    client.driver.findMany({
      where: { id: { in: driverIds } },
      select: { id: true, joiningDate: true, leavingDate: true },
    }),
  ]);
  const employedDays = new Map(
    employment.map((d) => [d.id, employedDaysInMonth(bounds, d.joiningDate, d.leavingDate)]),
  );
  const windowStart = windowStartFor(bounds);
  return inputs.map((input) => ({
    ...input,
    ...computeSalaryLine({
      baseSalaryPaise: input.baseSalaryPaise,
      absentDays: input.absentDays,
      daysInMonth: bounds.daysInMonth,
      employedDays: employedDays.get(input.driverId) ?? bounds.daysInMonth,
      windowStart,
      movements: movements.get(input.driverId) ?? [],
      outstandingEarlierRunsPaise: outstanding.get(input.driverId) ?? 0n,
    }),
  }));
}

type ComputedLine = Awaited<ReturnType<typeof computeLines>>[number];

const lineData = (line: ComputedLine) => ({
  baseSalaryPaise: line.baseSalaryPaise,
  absentDays: line.absentDays,
  presentDays: line.presentDays,
  earnedPaise: line.earnedPaise,
  salaryAdvancePaise: line.salaryAdvancePaise,
  logSlipBalancePaise: line.logSlipBalancePaise,
  otherPaymentsPaise: line.otherPaymentsPaise,
  previousBalancePaise: line.previousBalancePaise,
  netPaise: line.netPaise,
  remarks: line.remarks,
});

const runTotals = (lines: { earnedPaise: bigint; netPaise: bigint }[]) => ({
  totalEarnedPaise: lines.reduce((s, l) => s + l.earnedPaise, 0n),
  // A negative net carries forward — it is never "paid".
  totalNetPaise: lines.reduce((s, l) => s + (l.netPaise > 0n ? l.netPaise : 0n), 0n),
});

const lineSelect = {
  id: true,
  driverId: true,
  baseSalaryPaise: true,
  absentDays: true,
  remarks: true,
} as const;

type StoredLine = { id: string } & LineInput;

/**
 * Write every computed line in ONE statement instead of one UPDATE per driver
 * (each is a ~130 ms round trip to the remote database; a run has dozens).
 * Same columns lineData() writes, plus updatedAt — Prisma's @updatedAt does
 * not apply to raw SQL. Amounts go as text and are cast to bigint so no
 * precision is lost on the way.
 */
async function saveLines(
  tx: Prisma.TransactionClient,
  idByDriver: Map<string, string>,
  computed: ComputedLine[],
) {
  if (!computed.length) return;
  const rows = computed.map((line) => ({ id: idByDriver.get(line.driverId)!, ...lineData(line) }));
  const big = (pick: (r: (typeof rows)[number]) => bigint) => rows.map((r) => pick(r).toString());
  await tx.$executeRaw`
    UPDATE "DriverSalary" AS s SET
      "baseSalaryPaise"      = v.base,
      "absentDays"           = v.absent,
      "presentDays"          = v.present,
      "earnedPaise"          = v.earned,
      "salaryAdvancePaise"   = v.advance,
      "logSlipBalancePaise"  = v.log_slip,
      "otherPaymentsPaise"   = v.other,
      "previousBalancePaise" = v.previous,
      "netPaise"             = v.net,
      "remarks"              = v.remarks,
      "updatedAt"            = ${new Date().toISOString()}::timestamp(3)
    FROM unnest(
      ${rows.map((r) => r.id)}::text[],
      ${big((r) => r.baseSalaryPaise)}::bigint[],
      ${rows.map((r) => r.absentDays)}::int[],
      ${rows.map((r) => r.presentDays)}::int[],
      ${big((r) => r.earnedPaise)}::bigint[],
      ${big((r) => r.salaryAdvancePaise)}::bigint[],
      ${big((r) => r.logSlipBalancePaise)}::bigint[],
      ${big((r) => r.otherPaymentsPaise)}::bigint[],
      ${big((r) => r.previousBalancePaise)}::bigint[],
      ${big((r) => r.netPaise)}::bigint[],
      ${rows.map((r) => r.remarks)}::text[]
    ) AS v(id, base, absent, present, earned, advance, log_slip, other, previous, net, remarks)
    WHERE s."id" = v.id
  `;
}

/**
 * Recompute the given lines against the current ledger and save them.
 * `client` decides where the ledger is read: the transaction (approve — under
 * the driver locks, so nothing lands between reading and posting) or the
 * plain pool (draft edits — read in parallel, a preview that approve redoes).
 */
async function recomputeAndSave(
  tx: Prisma.TransactionClient,
  run: { id: string; month: string },
  lines: StoredLine[],
  computed?: ComputedLine[],
) {
  const result =
    computed ?? (await computeLines(tx, monthBounds(run.month), run.id, lines));
  await saveLines(tx, new Map(lines.map((l) => [l.driverId, l.id])), result);
  return result;
}

/* ------------------------------------------------------------------ */
/* Create / edit                                                       */
/* ------------------------------------------------------------------ */

/** The head-office branch — every salary run belongs to it (G2). */
export async function headOfficeBranch() {
  const ho = await db.branch.findFirst({
    where: { isHeadOffice: true },
    select: { id: true, name: true },
  });
  if (!ho)
    throw new BadRequestError(
      "No head-office branch is set — mark the head-office branch in the Branch master",
    );
  return ho;
}

export async function createSalaryRun(
  input: CreateDriverSalaryRunInput,
  actorId: string,
  branchId: string,
) {
  const bounds = monthBounds(input.month);
  assertMonthAllowed(bounds);

  const existing = await db.driverSalaryRun.findFirst({
    where: { month: input.month, status: { not: "CANCELLED" } },
    select: { runNumber: true },
  });
  if (existing)
    throw new BadRequestError(
      `A salary run for ${monthLabel(input.month)} already exists (${existing.runNumber})`,
    );
  await assertNoLaterApprovedRun(input.month);

  const drivers = await db.driver.findMany({
    where: {
      salary: { gt: 0 },
      // Employed during the month: joined before it ends, not left before it.
      AND: [
        { OR: [{ joiningDate: null }, { joiningDate: { lt: bounds.nextMonthStart } }] },
        { OR: [{ leavingDate: null }, { leavingDate: { gte: bounds.monthStart } }] },
      ],
    },
    select: { id: true, salary: true },
    orderBy: { name: "asc" },
  });
  if (!drivers.length)
    throw new BadRequestError("No driver has a salary set in the Driver master");

  const fyCode = fyCodeFor(bounds.monthEnd);
  const runNumber = await reserveDriverFinanceNumber(
    db,
    "SALARY_RUN",
    await branchCodeOf(branchId),
    fyCode,
  );

  return db.$transaction(async (tx) => {
    const computed = await computeLines(
      tx,
      bounds,
      null,
      drivers.map((d) => ({
        driverId: d.id,
        baseSalaryPaise: d.salary!,
        absentDays: 0,
        remarks: null,
      })),
    );
    try {
      return await tx.driverSalaryRun.create({
        data: {
          runNumber,
          month: input.month,
          daysInMonth: bounds.daysInMonth,
          branchId: branchId,
          fyCode,
          status: "DRAFT",
          createdById: actorId,
          ...runTotals(computed),
          salaries: {
            create: computed.map((line) => ({
              driverId: line.driverId,
              month: input.month,
              ...lineData(line),
            })),
          },
        },
        select: { id: true },
      });
    } catch (err) {
      if (isUniqueConflict(err))
        throw new BadRequestError(
          `A salary run for ${monthLabel(input.month)} was just created in another session`,
        );
      throw err;
    }
  });
}

/**
 * DRAFT edits: absent days, this month's salary, remarks, or removing a
 * driver. Every remaining line is then recalculated against the ledger —
 * an empty `lines` array is a plain "refresh".
 */
export async function updateSalaryRun(
  id: string,
  input: UpdateDriverSalaryRunInput,
  /** Branch-access check (the route's); runs before anything is written. */
  assertAccess: (branch: { id: string; name: string }) => void,
) {
  // The run and its lines in one round trip.
  const [run, stored] = await Promise.all([
    db.driverSalaryRun.findUnique({
      where: { id },
      include: { branch: { select: { id: true, name: true } } },
    }),
    db.driverSalary.findMany({ where: { runId: id, isActive: true }, select: lineSelect }),
  ]);
  if (!run) throw new NotFoundError("Salary run not found");
  assertAccess(run.branch);
  if (run.status !== "DRAFT") throw new BadRequestError("Only a draft salary run can be edited");
  if (run.version !== input.version) throw conflict();

  // Apply the edits in memory; everything is written once, below.
  const lineByDriver = new Map(stored.map((l) => [l.driverId, l]));
  const removeIds: string[] = [];
  const masterUpdates: { driverId: string; from: string; to: string }[] = [];
  for (const edit of input.lines) {


    const line = lineByDriver.get(edit.driverId);
    if (!line) throw new BadRequestError("A driver in this edit is not in the salary run");
    if (edit.remove) {
      removeIds.push(line.id);
      lineByDriver.delete(edit.driverId);
      continue;
    }
    // A changed salary can also become his salary in the Driver master.
    if (input.updateMaster && edit.baseSalaryPaise !== line.baseSalaryPaise)
      masterUpdates.push({
        driverId: edit.driverId,
        from: line.baseSalaryPaise.toString(),
        to: edit.baseSalaryPaise.toString(),
      });
    lineByDriver.set(edit.driverId, {
      ...line,
      absentDays: edit.absentDays,
      baseSalaryPaise: edit.baseSalaryPaise,
      remarks: edit.remarks ?? null,
    });
  }
  const lines = [...lineByDriver.values()];

  // A draft is a preview — nothing is posted, and approve recalculates under
  // the driver locks — so the ledger is read here, in parallel, outside the
  // transaction. The version check below still stops two overlapping edits.
  const computed = await computeLines(db, monthBounds(run.month), run.id, lines);

  return db.$transaction(async (tx) => {
    if (removeIds.length)
      await tx.driverSalary.deleteMany({ where: { id: { in: removeIds } } });
    for (const m of masterUpdates)
      await tx.driver.update({ where: { id: m.driverId }, data: { salary: BigInt(m.to) } });
    await recomputeAndSave(tx, run, lines, computed);
    try {
      const updated = await tx.driverSalaryRun.update({
        where: { id, version: input.version },
        data: { ...runTotals(computed), version: { increment: 1 } },
        select: { id: true },
      });
      return { ...updated, masterUpdates };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")
        throw conflict();
      throw err;
    }
  });
}

/* ------------------------------------------------------------------ */
/* Approve                                                             */
/* ------------------------------------------------------------------ */

/**
 * Recalculate every line one last time (so an advance entered a minute ago
 * is counted), then post ONE journal: Dr Driver Salary Expense / Cr each
 * driver (earned). After it, each driver's ledger balance is his net pay.
 */
export async function approveSalaryRun(
  id: string,
  version: number,
  actorId: string,
  /** Branch-access check (the route's); runs before anything is written. */
  assertAccess: (branch: { id: string; name: string }) => void,
) {
  const run = await db.driverSalaryRun.findUnique({
    where: { id },
    include: { branch: { select: { id: true, name: true } } },
  });
  if (!run) throw new NotFoundError("Salary run not found");
  assertAccess(run.branch);
  if (run.status !== "DRAFT") throw new BadRequestError("Only a draft salary run can be approved");
  if (run.version !== version) throw conflict();
  if (driverSalaryMakerCheckerEnabled() && run.createdById === actorId)
    throw new ForbiddenError(
      "Maker-checker is on — someone other than the person who created this run must approve it",
    );
  // Approving closes "Paid in cash" on the month's log slips and fixes the
  // salary — so not before the month's last day.
  if (!driverSalaryEarlyApprovalAllowed() && !canApproveMonth(run.month))
    throw new BadRequestError(
      `${monthLabel(run.month)} salary can be approved from ${approvableFrom(run.month)}, the last day of the month`,
    );
  // Both month-order checks only read — run them together.
  await Promise.all([
    assertPreviousMonthApproved(run.month),
    assertNoLaterApprovedRun(run.month),
  ]);

  const bounds = monthBounds(run.month);

  return db.$transaction(async (tx) => {
    // Hold every driver of the run so no advance / payment lands between the
    // recalculation and the posting — all locks in one round trip, in the
    // same fixed order as every other multi-driver lock (no deadlock).
    const lines = await tx.driverSalary.findMany({
      where: { runId: id, isActive: true },
      select: lineSelect,
    });
    if (!lines.length) throw new BadRequestError("This salary run has no drivers");
    await lockDrivers(tx, lines.map((l) => l.driverId));

    // Read the ledger INSIDE the transaction, after the locks.
    const computed = await recomputeAndSave(tx, run, lines);
    const journal = await postDriverSalaryRun(tx, {
      runId: run.id,
      runNumber: run.runNumber,
      branchId: run.branchId,
      fyCode: run.fyCode,
      voucherDate: bounds.monthEnd,
      narration: `Driver salary ${monthLabel(run.month)} — ${run.runNumber}`,
      lines: computed.map((l) => ({ driverId: l.driverId, earnedPaise: l.earnedPaise })),
      existingJournalEntryId: run.journalEntryId,
      createdById: actorId,
    });

    try {
      return await tx.driverSalaryRun.update({
        where: { id, version },
        data: {
          ...runTotals(computed),
          status: "APPROVED",
          approvedById: actorId,
          approvedAt: new Date(),
          journalEntryId: journal.id,
          version: { increment: 1 },
        },
        select: { id: true },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")
        throw conflict();
      throw err;
    }
  }, TX_OPTIONS);
}

/* ------------------------------------------------------------------ */
/* Pay                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Pay the selected drivers what is still outstanding on this run (net pay
 * minus what was already paid from it), from one or more cash / bank
 * accounts. The accounts are used in order and must add up to the total due;
 * a driver whose pay crosses from one account into the next is paid from both
 * (two payouts). Each account must hold enough money. A driver with a zero or
 * negative net is skipped — a negative carries into next month. The run turns
 * PAID once every positive net is fully paid.
 */
export async function paySalaryRun(id: string, input: PayDriverSalaryRunInput, actorId: string) {
  const run = await db.driverSalaryRun.findUnique({ where: { id } });
  if (!run) throw new NotFoundError("Salary run not found");
  if (run.status === "PAID") throw new BadRequestError("This salary run is already fully paid");
  if (run.status !== "APPROVED") throw new BadRequestError("Approve the salary run before paying it");
  assertOnOrAfterStart(input.paidAt, "Payment");
  const accountNames = await Promise.all(
    input.sources.map((src) => assertFundingMatchesMode(db, src.fundingLedgerId, src.mode)),
  );

  // A retried click: this request already paid — nothing more to do.
  const done = await db.driverPayout.findFirst({
    where: { clientRequestId: { startsWith: `${input.clientRequestId}:` } },
    select: { id: true },
  });
  if (done) return { id };

  const lines = await db.driverSalary.findMany({
    where: { runId: id, isActive: true, driverId: { in: input.driverIds } },
    select: { driverId: true, netPaise: true, driver: { select: { name: true } } },
  });
  if (lines.length !== new Set(input.driverIds).size)
    throw new BadRequestError("A selected driver is not in this salary run");

  const paid = await paidPerDriver(db, [id]);
  const dues = lines
    .map((l) => ({ ...l, amountPaise: l.netPaise - (paid.get(`${id}:${l.driverId}`) ?? 0n) }))
    .filter((l) => l.amountPaise > 0n)
    .sort((a, b) => a.driver.name.localeCompare(b.driver.name) || a.driverId.localeCompare(b.driverId));
  if (!dues.length) throw new BadRequestError("Nothing is left to pay to the selected drivers");

  const pieces = splitAcrossSources(dues, input.sources);
  const nameOf = new Map(dues.map((d) => [d.driverId, d.driver.name]));

  const fyCode = fyCodeFor(input.paidAt);
  const branchCode = await branchCodeOf(run.branchId);
  const numbers: string[] = [];
  for (let i = 0; i < pieces.length; i++)
    numbers.push(await reserveDriverFinanceNumber(db, "PAYOUT", branchCode, fyCode));

  return db.$transaction(async (tx) => {
    // Drivers first, then accounts — the same order as every other payment.
    await lockDrivers(tx, dues.map((d) => d.driverId));

    // Nothing may have been paid to these drivers since we worked it out.
    const fresh = await paidPerDriver(tx, [id], dues.map((d) => d.driverId));
    for (const d of dues) {
      const now = d.netPaise - (fresh.get(`${id}:${d.driverId}`) ?? 0n);
      if (now !== d.amountPaise)
        throw new BadRequestError(
          `${d.driver.name}'s salary was paid in another session — refresh and try again`,
        );
    }

    const sourceOrder = input.sources
      .map((src, index) => ({ src, index }))
      .sort((a, b) => a.src.fundingLedgerId.localeCompare(b.src.fundingLedgerId));
    for (const { src } of sourceOrder)
      await assertEnoughMoney(tx, src.fundingLedgerId, src.amountPaise);

    const pieceNo = new Map<string, number>();
    let paidNow = 0n;
    for (const [i, piece] of pieces.entries()) {
      const src = input.sources[piece.sourceIndex]!;
      const n = (pieceNo.get(piece.driverId) ?? 0) + 1;
      pieceNo.set(piece.driverId, n);
      const payoutNumber = numbers[i]!;
      const payout = await tx.driverPayout.create({
        data: {
          payoutNumber,
          driverId: piece.driverId,
          branchId: run.branchId,
          fyCode,
          source: "SALARY_RUN",
          salaryRunId: id,
          amountPaise: piece.amountPaise,
          paidAt: input.paidAt,
          mode: src.mode,
          referenceNo: input.referenceNo ?? null,
          fundingLedgerId: src.fundingLedgerId,
          clientRequestId: `${input.clientRequestId}:${piece.driverId}:${n}`,
          createdById: actorId,
        },
      });
      const journal = await postDriverPayout(tx, {
        sourceId: payout.id,
        voucherNumber: payoutNumber,
        driverId: piece.driverId,
        branchId: run.branchId,
        fyCode,
        paidAt: input.paidAt,
        fundingLedgerId: src.fundingLedgerId,
        amountPaise: piece.amountPaise,
        narration: `Salary ${monthLabel(run.month)} ${payoutNumber} — ${nameOf.get(piece.driverId)}${paidFromText(accountNames[piece.sourceIndex]!, src.mode)}`,
        createdById: actorId,
      });
      await tx.driverPayout.update({
        where: { id: payout.id },
        data: { journalEntryId: journal.id },
      });
      paidNow += piece.amountPaise;
    }

    // PAID once no driver with a positive net has anything left.
    const allLines = await tx.driverSalary.findMany({
      where: { runId: id, isActive: true, netPaise: { gt: 0 } },
      select: { driverId: true, netPaise: true },
    });
    const paidAfter = await paidPerDriver(tx, [id]);
    const fullyPaid = allLines.every(
      (l) => (paidAfter.get(`${id}:${l.driverId}`) ?? 0n) >= l.netPaise,
    );

    return tx.driverSalaryRun.update({
      where: { id },
      data: {
        paidPaise: { increment: paidNow },
        status: fullyPaid ? "PAID" : "APPROVED",
        version: { increment: 1 },
      },
      select: { id: true },
    });
  }, TX_OPTIONS);
}

/* ------------------------------------------------------------------ */
/* Cancel                                                              */
/* ------------------------------------------------------------------ */

/**
 * DRAFT: just cancelled. APPROVED with no payment yet: its salary journal is
 * reversed. Once any driver has been paid, reverse those payments first.
 * Cancelling frees every driver for a new run of the same month.
 */
export async function cancelSalaryRun(
  id: string,
  version: number,
  reason: string,
  actorId: string,
) {
  return db.$transaction(async (tx) => {
    const run = await tx.driverSalaryRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundError("Salary run not found");
    if (run.version !== version) throw conflict();
    if (run.status === "CANCELLED") throw new BadRequestError("This salary run is already cancelled");
    // A later approved month already counted this one — cancel that first.
    await assertNoLaterApprovedRun(run.month);
    if (run.status === "PAID")
      throw new BadRequestError("A paid salary run cannot be cancelled — reverse its payments first");

    if (run.status === "APPROVED") {
      const payments = await tx.driverPayout.count({
        where: { salaryRunId: id, status: "POSTED" },
      });
      if (payments > 0)
        throw new BadRequestError(
          `${payments} driver payment(s) were made from this run — reverse them in Driver Payments first`,
        );
      if (run.journalEntryId) await reverseJournal(tx, run.journalEntryId, reason, actorId);
    }

    await tx.driverSalary.updateMany({ where: { runId: id }, data: { isActive: false } });
    return tx.driverSalaryRun.update({
      where: { id, version },
      data: {
        status: "CANCELLED",
        cancelledById: actorId,
        cancelledAt: new Date(),
        cancelReason: reason,
        version: { increment: 1 },
      },
      select: { id: true },
    });
  }, TX_OPTIONS);
}

/* ------------------------------------------------------------------ */
/* Read                                                                */
/* ------------------------------------------------------------------ */

const namedUser = { select: { id: true, firstName: true, lastName: true } } as const;

/** Run header + every line with the driver, what was paid from this run and
 *  the vehicle(s) the driver drove that month. */
export async function salaryRunDetail(id: string) {
  const run = await db.driverSalaryRun.findUnique({
    where: { id },
    include: {
      branch: { select: { id: true, name: true, branchCode: true } },
      createdBy: namedUser,
      approvedBy: namedUser,
      cancelledBy: namedUser,
      salaries: {
        where: { isActive: true },
        include: {
          driver: { select: { id: true, name: true, joiningDate: true, leavingDate: true } },
        },
        orderBy: { driver: { name: "asc" } },
      },
    },
  });
  if (!run) throw new NotFoundError("Salary run not found");

  const bounds = monthBounds(run.month);
  const driverIds = run.salaries.map((s) => s.driverId);
  const [paid, payouts, journeys] = await Promise.all([
    paidPerDriver(db, [id]),
    // Every payment made from this run (reversed ones too, marked), with the
    // cash / bank account it came from — shown under each driver's Paid.
    db.driverPayout.findMany({
      where: { salaryRunId: id },
      select: {
        id: true,
        driverId: true,
        payoutNumber: true,
        amountPaise: true,
        paidAt: true,
        mode: true,
        status: true,
        journalEntryId: true,
        fundingLedger: { select: { id: true, name: true } },
      },
      orderBy: { paidAt: "asc" },
    }),
    db.vehicleJourney.findMany({
      where: {
        driverId: { in: driverIds },
        deletedAt: null,
        startedAt: { lt: bounds.nextMonthStart },
        OR: [{ closedAt: null }, { closedAt: { gte: bounds.monthStart } }],
      },
      select: {
        driverId: true,
        vehicleId: true,
        startedAt: true,
        closedAt: true,
        vehicle: { select: { vehicleNumber: true } },
      },
    }),
  ]);
  const vehiclesByDriver = new Map<string, Set<string>>();
  // A hint for the clerk typing absent days — never used in the maths: a
  // driver off a journey may still be at work (waiting for load, workshop).
  const journeyMsByDriver = new Map<string, number>();
  const now = new Date();
  for (const j of journeys) {
    const set = vehiclesByDriver.get(j.driverId) ?? new Set<string>();
    set.add(j.vehicle.vehicleNumber);
    vehiclesByDriver.set(j.driverId, set);
    const ms = overlapMs(
      { vehicleId: j.vehicleId, start: j.startedAt, end: j.closedAt },
      bounds.monthStart,
      bounds.nextMonthStart,
      now,
    );
    journeyMsByDriver.set(j.driverId, (journeyMsByDriver.get(j.driverId) ?? 0) + ms);
  }
  const journeyDays = (driverId: string) =>
    Math.min(run.daysInMonth, Math.ceil((journeyMsByDriver.get(driverId) ?? 0) / 86_400_000));

  return {
    ...run,
    monthLabel: monthLabel(run.month),
    approvableFrom: approvableFrom(run.month),
    canApproveNow: driverSalaryEarlyApprovalAllowed() || canApproveMonth(run.month),
    /** Totals paid per cash / bank account (posted payments only). */
    paidFrom: [
      ...payouts
        .filter((p) => p.status === "POSTED")
        .reduce((m, p) => {
          const e = m.get(p.fundingLedger.id) ?? { name: p.fundingLedger.name, amountPaise: 0n, count: 0 };
          e.amountPaise += p.amountPaise;
          e.count += 1;
          return m.set(p.fundingLedger.id, e);
        }, new Map<string, { name: string; amountPaise: bigint; count: number }>())
        .values(),
    ],
    salaries: run.salaries.map((s) => ({
      ...s,
      paidPaise: paid.get(`${id}:${s.driverId}`) ?? 0n,
      vehicles: [...(vehiclesByDriver.get(s.driverId) ?? [])],
      journeyDays: journeyDays(s.driverId),
      payouts: payouts.filter((p) => p.driverId === s.driverId),
    })),
  };
}
