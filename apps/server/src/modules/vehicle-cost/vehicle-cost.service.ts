import { db } from "../../../prisma/prisma.js";
import { driverSalaryByVehicle } from "../driver-finance/driver-salary-allocation.js";

/* ------------------------------------------------------------------ */
/* Monthly vehicle costs (reporting only — nothing posts to accounts)  */
/* ------------------------------------------------------------------ */

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** First instant of the month and first instant of the next (UTC). */
export const monthBounds = (month: string) => {
  const [year, mon] = month.split("-").map(Number) as [number, number];
  return {
    start: new Date(Date.UTC(year, mon - 1, 1)),
    endExclusive: new Date(Date.UTC(year, mon, 1)),
  };
};

export type FixedCosts = {
  taxPaise: bigint;
  insurancePaise: bigint;
  permitPaise: bigint;
  fitnessPaise: bigint;
  emiPaise: bigint;
};

/** What is typed on Vehicle Costs and stored. `salaryPaise` is other staff
 *  (cleaner / helper) — driver salary is not typed, see EffectiveCosts. */
export type MonthlyCosts = FixedCosts & {
  salaryPaise: bigint;
  tyrePaise: bigint;
  otherPaise: bigint;
};

/** MonthlyCosts plus the automatic driver salary: each driver's earned pay
 *  from an approved salary run, split across the vehicles he drove (see
 *  driver-salary-allocation.ts). Never stored or typed. */
export type EffectiveCosts = MonthlyCosts & { driverSalaryPaise: bigint };

export const ZERO_FIXED: FixedCosts = {
  taxPaise: 0n,
  insurancePaise: 0n,
  permitPaise: 0n,
  fitnessPaise: 0n,
  emiPaise: 0n,
};

const pickFixed = (row: FixedCosts): FixedCosts => ({
  taxPaise: row.taxPaise,
  insurancePaise: row.insurancePaise,
  permitPaise: row.permitPaise,
  fitnessPaise: row.fitnessPaise,
  emiPaise: row.emiPaise,
});

export type VehicleCostRow = EffectiveCosts & {
  vehicleId: string;
  vehicleNumber: string;
  /** True when a saved row exists for this month (else defaults apply). */
  hasMonthlyRow: boolean;
  remarks: string | null;
  defaults: FixedCosts;
};

/**
 * Effective costs for every own vehicle in a month: the month's saved row if
 * there is one, otherwise the vehicle's standing defaults for fixed costs and
 * zero for salary / tyre / other. Idle vehicles are included — fixed costs
 * are charged whether or not the truck ran.
 */
export async function listMonthlyCosts(month: string): Promise<VehicleCostRow[]> {
  const driverSalary = (await driverSalaryByVehicle([month])).byMonth.get(month)!;
  const vehicles = await db.vehicle.findMany({
    where: { ownershipType: "Own_Vehicle" },
    select: {
      id: true,
      vehicleNumber: true,
      costDefault: true,
      monthlyCosts: { where: { month } },
    },
    orderBy: { vehicleNumber: "asc" },
  });

  return vehicles.map((v) => {
    const defaults = v.costDefault ? pickFixed(v.costDefault) : ZERO_FIXED;
    const saved = v.monthlyCosts[0];
    return {
      vehicleId: v.id,
      vehicleNumber: v.vehicleNumber,
      hasMonthlyRow: Boolean(saved),
      remarks: saved?.remarks ?? null,
      defaults,
      driverSalaryPaise: driverSalary.get(v.id) ?? 0n,
      ...(saved
        ? {
            ...pickFixed(saved),
            salaryPaise: saved.salaryPaise,
            tyrePaise: saved.tyrePaise,
            otherPaise: saved.otherPaise,
          }
        : { ...defaults, salaryPaise: 0n, tyrePaise: 0n, otherPaise: 0n }),
    };
  });
}

/**
 * One vehicle's effective costs for each of `months` — same rule as
 * listMonthlyCosts (saved row, else defaults with zero salary/tyre/other),
 * in two queries however many months are asked for.
 */
export async function costsForVehicleMonths(
  vehicleId: string,
  months: string[],
): Promise<Map<string, EffectiveCosts>> {
  const [costDefault, saved, driverSalary] = await Promise.all([
    db.vehicleCostDefault.findUnique({ where: { vehicleId } }),
    db.vehicleMonthlyCost.findMany({
      where: { vehicleId, month: { in: months } },
    }),
    driverSalaryByVehicle(months),
  ]);
  const defaults = costDefault ? pickFixed(costDefault) : ZERO_FIXED;
  const savedByMonth = new Map(saved.map((row) => [row.month, row]));
  return new Map(
    months.map((month) => {
      const row = savedByMonth.get(month);
      const driverSalaryPaise = driverSalary.byMonth.get(month)?.get(vehicleId) ?? 0n;
      return [
        month,
        row
          ? {
              ...pickFixed(row),
              salaryPaise: row.salaryPaise,
              tyrePaise: row.tyrePaise,
              otherPaise: row.otherPaise,
              driverSalaryPaise,
            }
          : { ...defaults, salaryPaise: 0n, tyrePaise: 0n, otherPaise: 0n, driverSalaryPaise },
      ];
    }),
  );
}

/** Everything on Vehicle Costs for a month (typed + driver salary), as one amount. */
export const totalMonthlyCosts = (c: EffectiveCosts) =>
  c.driverSalaryPaise +
  c.taxPaise +
  c.insurancePaise +
  c.permitPaise +
  c.fitnessPaise +
  c.emiPaise +
  c.salaryPaise +
  c.tyrePaise +
  c.otherPaise;

export async function upsertMonthlyCost(
  vehicleId: string,
  month: string,
  data: MonthlyCosts & { remarks?: string | null },
  userId: string,
) {
  const fields = {
    taxPaise: data.taxPaise,
    insurancePaise: data.insurancePaise,
    permitPaise: data.permitPaise,
    fitnessPaise: data.fitnessPaise,
    emiPaise: data.emiPaise,
    salaryPaise: data.salaryPaise,
    tyrePaise: data.tyrePaise,
    otherPaise: data.otherPaise,
    remarks: data.remarks ?? null,
    updatedById: userId,
  };
  return db.vehicleMonthlyCost.upsert({
    where: { vehicleId_month: { vehicleId, month } },
    create: { vehicleId, month, ...fields },
    update: fields,
  });
}

export async function upsertCostDefault(
  vehicleId: string,
  data: FixedCosts,
  userId: string,
) {
  const fields = { ...pickFixed(data), updatedById: userId };
  return db.vehicleCostDefault.upsert({
    where: { vehicleId },
    create: { vehicleId, ...fields },
    update: fields,
  });
}
