import { db } from "../../../prisma/prisma.js";

/* ------------------------------------------------------------------ */
/* Vehicle P&L — rolls up every POSTED Log Slip per vehicle            */
/* ------------------------------------------------------------------ */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type VehiclePnlFilters = {
  from?: Date;
  to?: Date;
  vehicleId?: string;
  /** Matches against the vehicle's own number, case-insensitive. */
  search?: string;
  /** Zero-based page index; both page and size must be given to paginate —
   *  omitting them returns every vehicle (unpaginated), same convention as
   *  other list-vs-report endpoints in this codebase. */
  page?: number;
  size?: number;
};

export type VehiclePnlJourneyRow = {
  logSlipId: string;
  journeyId: string;
  journeyNumber: string;
  logSlipNumber: string | null;
  logSlipDate: Date;
  totalKm: number;
  totalFreightPaise: bigint;
  totalExpensePaise: bigint;
  netResultPaise: bigint;
};

export type VehiclePnlMonth = {
  /** "YYYY-MM" */
  month: string;
  freightPaise: bigint;
  expensePaise: bigint;
  repairsPaise: bigint;
  /** freight − trip expenses − repairs */
  profitPaise: bigint;
  km: number;
};

export type VehiclePnlRow = {
  vehicleId: string;
  vehicleNumber: string;
  journeyCount: number;
  totalKm: number;
  totalFreightPaise: bigint;
  /** Trip expenses from the Log Slips (diesel + toll + driver + other). */
  totalExpensePaise: bigint;
  /** Trip margin: freight − trip expenses (what the page showed before). */
  netResultPaise: bigint;
  totalDieselQty: number;
  actualAverage: number | null;

  /** Diesel amount, part of totalExpensePaise. */
  dieselPaise: bigint;
  /** totalExpensePaise − dieselPaise (toll, driver, other trip expenses). */
  otherExpensePaise: bigint;
  /** Finalised Job Card cost (parts + service) in the range. */
  repairsPaise: bigint;
  /** Trip margin − repairs. Excludes EMI/insurance/permit (not tracked yet). */
  profitAfterRepairsPaise: bigint;
  /** profitAfterRepairs ÷ freight × 100; null when there is no freight. */
  marginPct: number | null;
  revenuePerKmPaise: bigint | null;
  costPerKmPaise: bigint | null;
  profitPerKmPaise: bigint | null;
  profitPerJourneyPaise: bigint | null;
  profitPerDayPaise: bigint | null;

  loadedKm: number;
  emptyKm: number;
  emptyPct: number | null;
  runningDays: number;
  periodDays: number;
  utilisationPct: number | null;

  monthly: VehiclePnlMonth[];
  journeys: VehiclePnlJourneyRow[];
};

export type VehiclePnlSummary = {
  vehicleCount: number;
  lossMakingCount: number;
  totalFreightPaise: bigint;
  totalExpensePaise: bigint;
  totalRepairsPaise: bigint;
  profitAfterRepairsPaise: bigint;
  marginPct: number | null;
  totalKm: number;
  bestVehicle: { vehicleNumber: string; profitPaise: bigint } | null;
  worstVehicle: { vehicleNumber: string; profitPaise: bigint } | null;
};

export type VehiclePnlResult = {
  data: VehiclePnlRow[];
  total: number;
  summary: VehiclePnlSummary;
};

const monthKey = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

/** paise ÷ divisor, rounded; null when there is nothing to divide by. */
const perUnit = (paise: bigint, divisor: number): bigint | null =>
  divisor > 0 ? BigInt(Math.round(Number(paise) / divisor)) : null;

const pct = (part: number, whole: number): number | null =>
  whole > 0 ? (part / whole) * 100 : null;

type Acc = {
  vehicleId: string;
  vehicleNumber: string;
  journeyCount: number;
  totalKm: number;
  freight: bigint;
  expense: bigint;
  net: bigint;
  diesel: bigint;
  dieselQty: number;
  runningDays: number;
  firstStart: Date;
  lastSlipDate: Date;
  journeys: VehiclePnlJourneyRow[];
  months: Map<string, VehiclePnlMonth>;
};

const emptyMonth = (month: string): VehiclePnlMonth => ({
  month,
  freightPaise: 0n,
  expensePaise: 0n,
  repairsPaise: 0n,
  profitPaise: 0n,
  km: 0,
});

/**
 * One row per vehicle, summed across every Log Slip that actually reached
 * POSTED_TO_ACCOUNTS/TALLY_SYNCED (postedJournalEntryId set) in the range —
 * a DRAFT/GENERATED-but-unposted slip's numbers are not accounting fact yet
 * (see postLogSlipVoucher in posting.service.ts), so they're excluded here
 * the same way a bill in DRAFT never appears in the Debtor statement.
 *
 * Repairs come from FINALISED Job Cards (in-date within the range). Fixed
 * costs (EMI, insurance premium, permit/tax) are not tracked yet, so
 * `profitAfterRepairsPaise` is deliberately not called "net profit".
 * Sorted worst-first (profit after repairs ascending).
 */
export async function computeVehiclePnl(
  filters: VehiclePnlFilters = {},
): Promise<VehiclePnlResult> {
  const slips = await db.logSlip.findMany({
    where: {
      postedJournalEntryId: { not: null },
      ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
      ...(filters.search
        ? {
            vehicle: {
              vehicleNumber: { contains: filters.search, mode: "insensitive" },
            },
          }
        : {}),
      ...(filters.from || filters.to
        ? {
            logSlipDate: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    },
    select: {
      id: true,
      journeyId: true,
      journey: { select: { journeyNumber: true, startedAt: true } },
      logSlipNumber: true,
      logSlipDate: true,
      vehicleId: true,
      vehicle: { select: { id: true, vehicleNumber: true } },
      totalKm: true,
      totalDays: true,
      totalFreightPaise: true,
      totalExpensePaise: true,
      totalDieselAmountPaise: true,
      netVehicleResultPaise: true,
      totalDieselQty: true,
    },
    orderBy: { logSlipDate: "desc" },
  });

  const byVehicle = new Map<string, Acc>();
  for (const slip of slips) {
    const journeyRow: VehiclePnlJourneyRow = {
      logSlipId: slip.id,
      journeyId: slip.journeyId,
      journeyNumber: slip.journey.journeyNumber,
      logSlipNumber: slip.logSlipNumber,
      logSlipDate: slip.logSlipDate,
      totalKm: slip.totalKm,
      totalFreightPaise: slip.totalFreightPaise,
      totalExpensePaise: slip.totalExpensePaise,
      netResultPaise: slip.netVehicleResultPaise,
    };

    let acc = byVehicle.get(slip.vehicleId);
    if (!acc) {
      acc = {
        vehicleId: slip.vehicleId,
        vehicleNumber: slip.vehicle.vehicleNumber,
        journeyCount: 0,
        totalKm: 0,
        freight: 0n,
        expense: 0n,
        net: 0n,
        diesel: 0n,
        dieselQty: 0,
        runningDays: 0,
        firstStart: slip.journey.startedAt,
        lastSlipDate: slip.logSlipDate,
        journeys: [],
        months: new Map(),
      };
      byVehicle.set(slip.vehicleId, acc);
    }
    acc.journeyCount += 1;
    acc.totalKm += slip.totalKm;
    acc.freight += slip.totalFreightPaise;
    acc.expense += slip.totalExpensePaise;
    acc.net += slip.netVehicleResultPaise;
    acc.diesel += slip.totalDieselAmountPaise;
    acc.dieselQty += slip.totalDieselQty;
    acc.runningDays += slip.totalDays;
    if (slip.journey.startedAt < acc.firstStart)
      acc.firstStart = slip.journey.startedAt;
    if (slip.logSlipDate > acc.lastSlipDate) acc.lastSlipDate = slip.logSlipDate;
    acc.journeys.push(journeyRow);

    const key = monthKey(slip.logSlipDate);
    const month = acc.months.get(key) ?? emptyMonth(key);
    month.freightPaise += slip.totalFreightPaise;
    month.expensePaise += slip.totalExpensePaise;
    month.km += slip.totalKm;
    acc.months.set(key, month);
  }

  const vehicleIds = [...byVehicle.keys()];
  const journeyIds = slips.map((s) => s.journeyId);

  /* ---- repairs: finalised job cards for these vehicles ---- */
  const jobCards = vehicleIds.length
    ? await db.jobCard.findMany({
        where: {
          vehicleId: { in: vehicleIds },
          status: "FINALISED",
          ...(filters.from || filters.to
            ? {
                inDateTime: {
                  ...(filters.from ? { gte: filters.from } : {}),
                  ...(filters.to ? { lte: filters.to } : {}),
                },
              }
            : {}),
        },
        select: { vehicleId: true, inDateTime: true, totalAmountPaise: true },
      })
    : [];
  const repairsByVehicle = new Map<string, bigint>();
  for (const jc of jobCards) {
    repairsByVehicle.set(
      jc.vehicleId,
      (repairsByVehicle.get(jc.vehicleId) ?? 0n) + jc.totalAmountPaise,
    );
    const acc = byVehicle.get(jc.vehicleId);
    if (acc) {
      const key = monthKey(jc.inDateTime);
      const month = acc.months.get(key) ?? emptyMonth(key);
      month.repairsPaise += jc.totalAmountPaise;
      acc.months.set(key, month);
    }
  }

  /* ---- loaded vs empty KM from the journeys' closed trips ---- */
  const trips = journeyIds.length
    ? await db.vehicleTrip.findMany({
        where: {
          journeyId: { in: journeyIds },
          deletedAt: null,
          status: "Closed",
          closingKm: { not: null },
        },
        select: {
          vehicleId: true,
          isTripEmpty: true,
          openingKm: true,
          closingKm: true,
        },
      })
    : [];
  const kmByVehicle = new Map<string, { loaded: number; empty: number }>();
  for (const trip of trips) {
    const km = Math.max(0, (trip.closingKm ?? trip.openingKm) - trip.openingKm);
    const entry = kmByVehicle.get(trip.vehicleId) ?? { loaded: 0, empty: 0 };
    if (trip.isTripEmpty) entry.empty += km;
    else entry.loaded += km;
    kmByVehicle.set(trip.vehicleId, entry);
  }

  const allRows: VehiclePnlRow[] = [...byVehicle.values()].map((acc) => {
    const repairs = repairsByVehicle.get(acc.vehicleId) ?? 0n;
    const profit = acc.net - repairs;
    const km = kmByVehicle.get(acc.vehicleId) ?? { loaded: 0, empty: 0 };

    const periodStart = filters.from ?? acc.firstStart;
    const periodEnd = filters.to ?? acc.lastSlipDate;
    const periodDays = Math.max(
      1,
      Math.ceil((periodEnd.getTime() - periodStart.getTime()) / MS_PER_DAY),
    );

    return {
      vehicleId: acc.vehicleId,
      vehicleNumber: acc.vehicleNumber,
      journeyCount: acc.journeyCount,
      totalKm: acc.totalKm,
      totalFreightPaise: acc.freight,
      totalExpensePaise: acc.expense,
      netResultPaise: acc.net,
      totalDieselQty: acc.dieselQty,
      actualAverage: acc.dieselQty > 0 ? acc.totalKm / acc.dieselQty : null,

      dieselPaise: acc.diesel,
      otherExpensePaise: acc.expense - acc.diesel,
      repairsPaise: repairs,
      profitAfterRepairsPaise: profit,
      marginPct: pct(Number(profit), Number(acc.freight)),
      revenuePerKmPaise: perUnit(acc.freight, acc.totalKm),
      costPerKmPaise: perUnit(acc.expense + repairs, acc.totalKm),
      profitPerKmPaise: perUnit(profit, acc.totalKm),
      profitPerJourneyPaise: perUnit(profit, acc.journeyCount),
      profitPerDayPaise: perUnit(profit, acc.runningDays),

      loadedKm: km.loaded,
      emptyKm: km.empty,
      emptyPct: pct(km.empty, km.loaded + km.empty),
      runningDays: acc.runningDays,
      periodDays,
      utilisationPct: Math.min(100, (acc.runningDays / periodDays) * 100),

      monthly: [...acc.months.values()]
        .map((m) => ({
          ...m,
          profitPaise: m.freightPaise - m.expensePaise - m.repairsPaise,
        }))
        .sort((a, b) => (a.month < b.month ? -1 : 1)),
      journeys: acc.journeys,
    };
  });

  allRows.sort((a, b) =>
    a.profitAfterRepairsPaise < b.profitAfterRepairsPaise ? -1 : 1,
  );

  const totalFreight = allRows.reduce((s, r) => s + r.totalFreightPaise, 0n);
  const totalExpense = allRows.reduce((s, r) => s + r.totalExpensePaise, 0n);
  const totalRepairs = allRows.reduce((s, r) => s + r.repairsPaise, 0n);
  const totalProfit = totalFreight - totalExpense - totalRepairs;
  const worst = allRows[0];
  const best = allRows[allRows.length - 1];
  const summary: VehiclePnlSummary = {
    vehicleCount: allRows.length,
    lossMakingCount: allRows.filter((r) => r.profitAfterRepairsPaise < 0n)
      .length,
    totalFreightPaise: totalFreight,
    totalExpensePaise: totalExpense,
    totalRepairsPaise: totalRepairs,
    profitAfterRepairsPaise: totalProfit,
    marginPct: pct(Number(totalProfit), Number(totalFreight)),
    totalKm: allRows.reduce((s, r) => s + r.totalKm, 0),
    bestVehicle: best
      ? {
          vehicleNumber: best.vehicleNumber,
          profitPaise: best.profitAfterRepairsPaise,
        }
      : null,
    worstVehicle: worst
      ? {
          vehicleNumber: worst.vehicleNumber,
          profitPaise: worst.profitAfterRepairsPaise,
        }
      : null,
  };

  const total = allRows.length;
  if (filters.page === undefined || filters.size === undefined)
    return { data: allRows, total, summary };

  const start = filters.page * filters.size;
  return { data: allRows.slice(start, start + filters.size), total, summary };
}
