import { db } from "../../../prisma/prisma.js";
import { monthBounds } from "./salary-run.compute.js";
import {
  overlapMs,
  splitByWeight,
  type JourneySpan,
} from "./driver-salary-allocation.compute.js";

/**
 * Driver salary → vehicles (Driver Lifecycle Phase 5). Each driver's earned
 * salary from an APPROVED/PAID salary run is a cost of the vehicle(s) he drove
 * that month, split by how long he was on each vehicle's journeys. It shows
 * up as the automatic "Driver salary" line of Vehicle Costs, so Vehicle P&L
 * and Vehicle Performance pick it up from there. Reporting only — nothing
 * posts to accounts.
 */

export type DriverSalaryAllocation = {
  /** month → vehicleId → driver salary charged to that vehicle */
  byMonth: Map<string, Map<string, bigint>>;
  /** month → salary of drivers who drove no vehicle that month */
  unallocatedByMonth: Map<string, bigint>;
};

/** Earned driver salary per vehicle for each of `months`. */
export async function driverSalaryByVehicle(
  months: string[],
  now: Date = new Date(),
): Promise<DriverSalaryAllocation> {
  const byMonth = new Map<string, Map<string, bigint>>(months.map((m) => [m, new Map()]));
  const unallocatedByMonth = new Map<string, bigint>(months.map((m) => [m, 0n]));
  if (!months.length) return { byMonth, unallocatedByMonth };

  const lines = await db.driverSalary.findMany({
    where: {
      month: { in: months },
      isActive: true,
      earnedPaise: { gt: 0 },
      run: { status: { in: ["APPROVED", "PAID"] } },
    },
    select: { driverId: true, month: true, earnedPaise: true },
  });
  if (!lines.length) return { byMonth, unallocatedByMonth };

  const sorted = [...months].sort();
  const rangeStart = monthBounds(sorted[0]!).monthStart;
  const rangeEnd = monthBounds(sorted[sorted.length - 1]!).nextMonthStart;
  const journeys = await db.vehicleJourney.findMany({
    where: {
      driverId: { in: [...new Set(lines.map((l) => l.driverId))] },
      deletedAt: null,
      startedAt: { lt: rangeEnd },
      OR: [{ closedAt: null }, { closedAt: { gte: rangeStart } }],
    },
    select: { driverId: true, vehicleId: true, startedAt: true, closedAt: true },
  });
  const spansByDriver = new Map<string, JourneySpan[]>();
  for (const j of journeys) {
    const list = spansByDriver.get(j.driverId) ?? [];
    list.push({ vehicleId: j.vehicleId, start: j.startedAt, end: j.closedAt });
    spansByDriver.set(j.driverId, list);
  }

  for (const line of lines) {
    const { monthStart, nextMonthStart } = monthBounds(line.month);
    const weights = new Map<string, number>();
    for (const span of spansByDriver.get(line.driverId) ?? []) {
      const ms = overlapMs(span, monthStart, nextMonthStart, now);
      if (ms > 0) weights.set(span.vehicleId, (weights.get(span.vehicleId) ?? 0) + ms);
    }
    const shares = splitByWeight(line.earnedPaise, weights);
    if (!shares.size) {
      unallocatedByMonth.set(line.month, unallocatedByMonth.get(line.month)! + line.earnedPaise);
      continue;
    }
    const monthMap = byMonth.get(line.month)!;
    for (const [vehicleId, share] of shares)
      monthMap.set(vehicleId, (monthMap.get(vehicleId) ?? 0n) + share);
  }
  return { byMonth, unallocatedByMonth };
}
