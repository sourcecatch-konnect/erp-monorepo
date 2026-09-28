import { db } from "../../../prisma/prisma.js";
import {
  listMonthlyCosts,
  monthBounds,
} from "../vehicle-cost/vehicle-cost.service.js";

/* ------------------------------------------------------------------ */
/* Monthly Vehicle Performance Report                                  */
/* One row per OWN vehicle for a calendar month, including idle ones.   */
/* result = trip balance − fixed costs − variable costs                 */
/* ------------------------------------------------------------------ */

/** A posted Log Slip counted in the month; the page links to it for the legs. */
export type MonthlyPnlSlip = {
  logSlipId: string;
  journeyId: string;
  logSlipNumber: string | null;
};

export type MonthlyPnlRow = {
  vehicleId: string;
  vehicleNumber: string;
  /** First journey start and last journey close/slip date in the month. */
  periodFrom: Date | null;
  periodTo: Date | null;
  trips: number;
  days: number;
  km: number;
  freightPaise: bigint;
  dieselPaise: bigint;
  otherExpensePaise: bigint;
  totalExpensePaise: bigint;
  /** freight − trip expenses (the sheet's "Net Balance"). */
  tripBalancePaise: bigint;

  taxPaise: bigint;
  insurancePaise: bigint;
  permitPaise: bigint;
  fitnessPaise: bigint;
  emiPaise: bigint;
  salaryPaise: bigint;
  /** Sum of the six fixed/monthly lines above ("Mtly Fxd"). */
  fixedTotalPaise: bigint;

  /** Finalised Job Card cost in the month (auto). */
  repairsPaise: bigint;
  tyrePaise: bigint;
  otherCostPaise: bigint;
  /** Sum of the three variable lines above ("Mtly V'ble"). */
  variableTotalPaise: bigint;

  /** tripBalance − fixedTotal − variableTotal (the sheet's "G.Total"). */
  resultPaise: bigint;
  hasMonthlyCostRow: boolean;

  /** Freight billed on the LRs carried (LR group base freight). Only trips
   *  whose every LR group has a booking amount count — see freightDiffPaise. */
  bookingFreightPaise: bigint;
  /** Booking − onward freight on those same trips: the margin the company
   *  keeps that no vehicle is credited with (the "Freight Difference" sheet). */
  freightDiffPaise: bigint;
  /** Loaded trips skipped because an LR group has no booking amount yet. */
  missingBookingTrips: number;
  /** Months in the period in which the vehicle had a posted Log Slip. */
  monthsRan: number;

  /** The month's posted Log Slips, oldest first. */
  slips: MonthlyPnlSlip[];
};

export type MonthlyPnlTotals = {
  vehicleCount: number;
  profitVehicleCount: number;
  lossVehicleCount: number;
  profitAmountPaise: bigint;
  /** Sum of negative results, as a negative number. */
  lossAmountPaise: bigint;
  netPaise: bigint;
  freightPaise: bigint;
  fixedTotalPaise: bigint;
  variableTotalPaise: bigint;
  bookingFreightPaise: bigint;
  freightDiffPaise: bigint;
  /** netPaise + freightDiffPaise: what the fleet earned the business. */
  businessResultPaise: bigint;
  missingBookingTrips: number;
};

export type MonthlyPnlResult = {
  /** Inclusive "YYYY-MM" range; from === to for a single month. */
  from: string;
  to: string;
  monthCount: number;
  rows: MonthlyPnlRow[];
  totals: MonthlyPnlTotals;
};

/** Longest range a period report may cover (two financial years). */
export const MAX_PERIOD_MONTHS = 24;

/** Every "YYYY-MM" from `from` to `to`, inclusive. */
export const monthRange = (from: string, to: string): string[] => {
  const [fy, fm] = from.split("-").map(Number) as [number, number];
  const [ty, tm] = to.split("-").map(Number) as [number, number];
  const months: string[] = [];
  for (let i = fy * 12 + fm - 1; i <= ty * 12 + tm - 1; i++)
    months.push(
      `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`,
    );
  return months;
};

const BIGINT_KEYS = [
  "freightPaise",
  "dieselPaise",
  "otherExpensePaise",
  "totalExpensePaise",
  "tripBalancePaise",
  "taxPaise",
  "insurancePaise",
  "permitPaise",
  "fitnessPaise",
  "emiPaise",
  "salaryPaise",
  "fixedTotalPaise",
  "repairsPaise",
  "tyrePaise",
  "otherCostPaise",
  "variableTotalPaise",
  "resultPaise",
  "bookingFreightPaise",
  "freightDiffPaise",
] as const satisfies readonly (keyof MonthlyPnlRow)[];

const NUMBER_KEYS = [
  "trips",
  "days",
  "km",
  "missingBookingTrips",
  "monthsRan",
] as const satisfies readonly (keyof MonthlyPnlRow)[];

/**
 * The report over a range of months: each month is computed exactly as the
 * single-month report (so fixed costs are charged once per month, idle or
 * not) and the vehicle rows are summed. A quarter therefore always equals
 * the sum of its three monthly reports.
 */
export async function computeMonthlyVehiclePnl(
  from: string,
  to: string = from,
): Promise<MonthlyPnlResult> {
  const months = monthRange(from, to);
  const byVehicle = new Map<string, MonthlyPnlRow>();
  // Sequential on purpose: each month runs several queries, and a year in
  // parallel would crowd the connection pool.
  for (const month of months) {
    for (const row of await computeMonthRows(month)) {
      const acc = byVehicle.get(row.vehicleId);
      if (!acc) {
        byVehicle.set(row.vehicleId, { ...row, slips: [...row.slips] });
        continue;
      }
      for (const key of BIGINT_KEYS) acc[key] += row[key];
      for (const key of NUMBER_KEYS) acc[key] += row[key];
      if (row.periodFrom && (!acc.periodFrom || row.periodFrom < acc.periodFrom))
        acc.periodFrom = row.periodFrom;
      if (row.periodTo && (!acc.periodTo || row.periodTo > acc.periodTo))
        acc.periodTo = row.periodTo;
      acc.hasMonthlyCostRow ||= row.hasMonthlyCostRow;
      acc.slips.push(...row.slips);
    }
  }
  const rows = [...byVehicle.values()];

  // Worst first, like the accountant's loss-highlighted sheet.
  rows.sort((a, b) => (a.resultPaise < b.resultPaise ? -1 : 1));

  const sum = (pick: (r: MonthlyPnlRow) => bigint) =>
    rows.reduce((s, r) => s + pick(r), 0n);
  const totals: MonthlyPnlTotals = {
    vehicleCount: rows.length,
    profitVehicleCount: rows.filter((r) => r.resultPaise > 0n).length,
    lossVehicleCount: rows.filter((r) => r.resultPaise < 0n).length,
    profitAmountPaise: rows.reduce(
      (s, r) => (r.resultPaise > 0n ? s + r.resultPaise : s),
      0n,
    ),
    lossAmountPaise: rows.reduce(
      (s, r) => (r.resultPaise < 0n ? s + r.resultPaise : s),
      0n,
    ),
    netPaise: sum((r) => r.resultPaise),
    freightPaise: sum((r) => r.freightPaise),
    fixedTotalPaise: sum((r) => r.fixedTotalPaise),
    variableTotalPaise: sum((r) => r.variableTotalPaise),
    bookingFreightPaise: sum((r) => r.bookingFreightPaise),
    freightDiffPaise: sum((r) => r.freightDiffPaise),
    businessResultPaise: sum((r) => r.resultPaise + r.freightDiffPaise),
    missingBookingTrips: rows.reduce((s, r) => s + r.missingBookingTrips, 0),
  };

  return { from, to, monthCount: months.length, rows, totals };
}

export type FreightDiff = { booking: bigint; diff: bigint; missing: number };

/**
 * Freight difference per vehicle over the given journeys: booking freight
 * billed on each loaded trip's LRs minus the onward freight credited to the
 * vehicle. Same trip filter as the journey's freight total. Only primary
 * groups — a group's secondary leg would otherwise count its booking twice.
 * A trip with any LR group lacking a booking amount is skipped and counted
 * in `missing`, so a missing entry doesn't read as a loss.
 */
export async function freightDiffByVehicle(
  journeyIds: string[],
): Promise<Map<string, FreightDiff>> {
  const trips = journeyIds.length
    ? await db.vehicleTrip.findMany({
        where: {
          journeyId: { in: journeyIds },
          deletedAt: null,
          status: { not: "Cancelled" },
          primaryGroups: { some: { deletedAt: null } },
        },
        select: {
          vehicleId: true,
          onwardFreight: true,
          primaryGroups: {
            where: { deletedAt: null },
            select: { baseFreightAmount: true },
          },
        },
      })
    : [];
  const byVehicle = new Map<string, FreightDiff>();
  for (const trip of trips) {
    const d = byVehicle.get(trip.vehicleId) ?? { booking: 0n, diff: 0n, missing: 0 };
    if (trip.primaryGroups.some((g) => g.baseFreightAmount === null)) {
      d.missing += 1;
    } else {
      const booking = trip.primaryGroups.reduce(
        (s, g) => s + (g.baseFreightAmount ?? 0n),
        0n,
      );
      d.booking += booking;
      d.diff += booking - trip.onwardFreight;
    }
    byVehicle.set(trip.vehicleId, d);
  }
  return byVehicle;
}

/** One calendar month: a row per own vehicle, idle ones included. */
async function computeMonthRows(month: string): Promise<MonthlyPnlRow[]> {
  const { start, endExclusive } = monthBounds(month);

  const [costs, slips, jobCards] = await Promise.all([
    listMonthlyCosts(month),
    db.logSlip.findMany({
      where: {
        postedJournalEntryId: { not: null },
        logSlipDate: { gte: start, lt: endExclusive },
        vehicle: { ownershipType: "Own_Vehicle" },
      },
      select: {
        id: true,
        journeyId: true,
        logSlipNumber: true,
        vehicleId: true,
        logSlipDate: true,
        totalKm: true,
        totalDays: true,
        totalFreightPaise: true,
        totalExpensePaise: true,
        totalDieselAmountPaise: true,
        journey: { select: { startedAt: true, closedAt: true } },
      },
      orderBy: { logSlipDate: "asc" },
    }),
    db.jobCard.findMany({
      where: {
        status: "FINALISED",
        inDateTime: { gte: start, lt: endExclusive },
        vehicle: { ownershipType: "Own_Vehicle" },
      },
      select: { vehicleId: true, totalAmountPaise: true },
    }),
  ]);

  type Trip = {
    trips: number;
    days: number;
    km: number;
    freight: bigint;
    diesel: bigint;
    expense: bigint;
    from: Date | null;
    to: Date | null;
    slips: MonthlyPnlSlip[];
  };
  const tripsByVehicle = new Map<string, Trip>();
  for (const slip of slips) {
    const t = tripsByVehicle.get(slip.vehicleId) ?? {
      trips: 0,
      days: 0,
      km: 0,
      freight: 0n,
      diesel: 0n,
      expense: 0n,
      from: null,
      to: null,
      slips: [],
    };
    t.slips.push({
      logSlipId: slip.id,
      journeyId: slip.journeyId,
      logSlipNumber: slip.logSlipNumber,
    });
    t.trips += 1;
    t.days += slip.totalDays;
    t.km += slip.totalKm;
    t.freight += slip.totalFreightPaise;
    t.diesel += slip.totalDieselAmountPaise;
    t.expense += slip.totalExpensePaise;
    const started = slip.journey.startedAt;
    const ended = slip.journey.closedAt ?? slip.logSlipDate;
    if (!t.from || started < t.from) t.from = started;
    if (!t.to || ended > t.to) t.to = ended;
    tripsByVehicle.set(slip.vehicleId, t);
  }

  const diffByVehicle = await freightDiffByVehicle(
    slips.map((s) => s.journeyId),
  );

  const repairsByVehicle = new Map<string, bigint>();
  for (const jc of jobCards)
    repairsByVehicle.set(
      jc.vehicleId,
      (repairsByVehicle.get(jc.vehicleId) ?? 0n) + jc.totalAmountPaise,
    );

  return costs.map((c): MonthlyPnlRow => {
    const t = tripsByVehicle.get(c.vehicleId);
    const freight = t?.freight ?? 0n;
    const expense = t?.expense ?? 0n;
    const diesel = t?.diesel ?? 0n;
    const repairs = repairsByVehicle.get(c.vehicleId) ?? 0n;
    const tripBalance = freight - expense;
    const fixedTotal =
      c.taxPaise +
      c.insurancePaise +
      c.permitPaise +
      c.fitnessPaise +
      c.emiPaise +
      c.salaryPaise;
    const variableTotal = repairs + c.tyrePaise + c.otherPaise;
    return {
      vehicleId: c.vehicleId,
      vehicleNumber: c.vehicleNumber,
      periodFrom: t?.from ?? null,
      periodTo: t?.to ?? null,
      trips: t?.trips ?? 0,
      days: t?.days ?? 0,
      km: t?.km ?? 0,
      freightPaise: freight,
      dieselPaise: diesel,
      otherExpensePaise: expense - diesel,
      totalExpensePaise: expense,
      tripBalancePaise: tripBalance,
      taxPaise: c.taxPaise,
      insurancePaise: c.insurancePaise,
      permitPaise: c.permitPaise,
      fitnessPaise: c.fitnessPaise,
      emiPaise: c.emiPaise,
      salaryPaise: c.salaryPaise,
      fixedTotalPaise: fixedTotal,
      repairsPaise: repairs,
      tyrePaise: c.tyrePaise,
      otherCostPaise: c.otherPaise,
      variableTotalPaise: variableTotal,
      resultPaise: tripBalance - fixedTotal - variableTotal,
      hasMonthlyCostRow: c.hasMonthlyRow,
      bookingFreightPaise: diffByVehicle.get(c.vehicleId)?.booking ?? 0n,
      freightDiffPaise: diffByVehicle.get(c.vehicleId)?.diff ?? 0n,
      missingBookingTrips: diffByVehicle.get(c.vehicleId)?.missing ?? 0,
      monthsRan: t ? 1 : 0,
      slips: t?.slips ?? [],
    };
  });
}

/* ------------------------------------------------------------------ */
/* Monthly vehicle sheet — the accountant's per-vehicle, leg-by-leg    */
/* layout. Legs come from the Log Slip's frozen TRIP_FREIGHT lines,     */
/* the same source as the Log Slip PDF, so they match what was posted.  */
/* ------------------------------------------------------------------ */

export type SheetLeg = {
  from: string;
  to: string;
  lrNumbers: string[];
  /** Leg start — the sheet's "L.R. Date". */
  date: string | null;
  freightPaise: bigint;
  isEmpty: boolean;
};

export type SheetSlip = {
  logSlipNumber: string | null;
  logSlipDate: Date;
  driverName: string;
  km: number;
  days: number;
  freightPaise: bigint;
  dieselPaise: bigint;
  /** Toll, driver and other trip expenses (total expenses − diesel). */
  cashPaise: bigint;
  expensePaise: bigint;
  /** freight − expenses: the sheet's "Net Balance". */
  netPaise: bigint;
  driverPayablePaise: bigint;
  driverReceivablePaise: bigint;
  legs: SheetLeg[];
};

/* Older slips may lack metadata — fall back to the "Leg n: From → To
   (empty)" description, as the Log Slip PDF does. */
function toSheetLeg(line: {
  description: string;
  amountPaise: bigint;
  metadata: unknown;
}): SheetLeg {
  const meta =
    line.metadata && typeof line.metadata === "object" && !Array.isArray(line.metadata)
      ? (line.metadata as Record<string, unknown>)
      : {};
  const text = (key: string) =>
    typeof meta[key] === "string" ? (meta[key] as string) : null;
  const route = line.description.match(
    /:\s*(.*?)\s*(?:→|->)\s*(.*?)(?:\s*\(empty\))?$/i,
  );
  return {
    from: text("source") ?? route?.[1]?.trim() ?? "-",
    to: text("destination") ?? route?.[2]?.trim() ?? "-",
    lrNumbers: Array.isArray(meta.lrNumbers)
      ? meta.lrNumbers.filter(
          (n): n is string => typeof n === "string" && Boolean(n),
        )
      : [],
    date: text("startedAt"),
    freightPaise: line.amountPaise,
    isEmpty: meta.isEmpty === true || /\(empty\)/i.test(line.description),
  };
}

/** Posted Log Slips of own vehicles in the month range, grouped per vehicle,
 *  oldest first — the same slips the Performance report counts. */
export async function loadSheetSlips(
  from: string,
  to: string,
): Promise<Map<string, SheetSlip[]>> {
  const slips = await db.logSlip.findMany({
    where: {
      postedJournalEntryId: { not: null },
      logSlipDate: {
        gte: monthBounds(from).start,
        lt: monthBounds(to).endExclusive,
      },
      vehicle: { ownershipType: "Own_Vehicle" },
    },
    select: {
      vehicleId: true,
      logSlipNumber: true,
      logSlipDate: true,
      totalKm: true,
      totalDays: true,
      totalFreightPaise: true,
      totalExpensePaise: true,
      totalDieselAmountPaise: true,
      netVehicleResultPaise: true,
      driverPayablePaise: true,
      driverReceivablePaise: true,
      driver: { select: { name: true } },
      lines: {
        where: { lineType: "TRIP_FREIGHT" },
        orderBy: { sortOrder: "asc" },
        select: { description: true, amountPaise: true, metadata: true },
      },
    },
    orderBy: { logSlipDate: "asc" },
  });

  const byVehicle = new Map<string, SheetSlip[]>();
  for (const slip of slips) {
    const list = byVehicle.get(slip.vehicleId) ?? [];
    list.push({
      logSlipNumber: slip.logSlipNumber,
      logSlipDate: slip.logSlipDate,
      driverName: slip.driver.name,
      km: slip.totalKm,
      days: slip.totalDays,
      freightPaise: slip.totalFreightPaise,
      dieselPaise: slip.totalDieselAmountPaise,
      cashPaise: slip.totalExpensePaise - slip.totalDieselAmountPaise,
      expensePaise: slip.totalExpensePaise,
      netPaise: slip.netVehicleResultPaise,
      driverPayablePaise: slip.driverPayablePaise,
      driverReceivablePaise: slip.driverReceivablePaise,
      legs: slip.lines.map(toSheetLeg),
    });
    byVehicle.set(slip.vehicleId, list);
  }
  return byVehicle;
}
