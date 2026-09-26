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
  month: string;
  rows: MonthlyPnlRow[];
  totals: MonthlyPnlTotals;
};

export async function computeMonthlyVehiclePnl(
  month: string,
): Promise<MonthlyPnlResult> {
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

  /* ---- freight difference: booking (billed) vs onward (credited) ---- */
  // Same trip filter as the journey's freight total. Only primary groups —
  // a group's secondary leg would otherwise count its booking twice.
  const trips = slips.length
    ? await db.vehicleTrip.findMany({
        where: {
          journeyId: { in: slips.map((s) => s.journeyId) },
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
  type Diff = { booking: bigint; diff: bigint; missing: number };
  const diffByVehicle = new Map<string, Diff>();
  for (const trip of trips) {
    const d = diffByVehicle.get(trip.vehicleId) ?? {
      booking: 0n,
      diff: 0n,
      missing: 0,
    };
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
    diffByVehicle.set(trip.vehicleId, d);
  }

  const repairsByVehicle = new Map<string, bigint>();
  for (const jc of jobCards)
    repairsByVehicle.set(
      jc.vehicleId,
      (repairsByVehicle.get(jc.vehicleId) ?? 0n) + jc.totalAmountPaise,
    );

  const rows: MonthlyPnlRow[] = costs.map((c) => {
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
      slips: t?.slips ?? [],
    };
  });

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

  return { month, rows, totals };
}
