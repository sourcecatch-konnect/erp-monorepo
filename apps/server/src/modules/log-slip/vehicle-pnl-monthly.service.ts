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
        vehicleId: true,
        logSlipDate: true,
        totalKm: true,
        totalDays: true,
        totalFreightPaise: true,
        totalExpensePaise: true,
        totalDieselAmountPaise: true,
        journey: { select: { startedAt: true, closedAt: true } },
      },
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
    };
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
  };

  return { month, rows, totals };
}
