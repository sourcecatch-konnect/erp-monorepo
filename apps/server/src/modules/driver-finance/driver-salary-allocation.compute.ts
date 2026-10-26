/**
 * Pure maths for splitting a driver's salary across the vehicles he drove
 * (no DB) — see driver-salary-allocation.ts.
 */

export type JourneySpan = { vehicleId: string; start: Date; end: Date | null };

/** Time a journey overlaps [monthStart, nextMonthStart), in ms. An open
 *  journey runs until `now` (capped at the month end). */
export function overlapMs(
  span: JourneySpan,
  monthStart: Date,
  nextMonthStart: Date,
  now: Date,
): number {
  const end = span.end ?? (now < nextMonthStart ? now : nextMonthStart);
  const from = Math.max(span.start.getTime(), monthStart.getTime());
  const to = Math.min(end.getTime(), nextMonthStart.getTime());
  return Math.max(0, to - from);
}

/**
 * Split `amountPaise` across vehicles in proportion to `weights`, in whole
 * rupees where possible; the rounding remainder goes to the heaviest vehicle
 * so the parts always add back up to the amount exactly.
 */
export function splitByWeight(
  amountPaise: bigint,
  weights: Map<string, number>,
): Map<string, bigint> {
  const entries = [...weights.entries()].filter(([, w]) => w > 0);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  const result = new Map<string, bigint>();
  if (!entries.length || total <= 0 || amountPaise === 0n) return result;

  let given = 0n;
  let heaviest = entries[0]![0];
  let heaviestWeight = -1;
  for (const [vehicleId, weight] of entries) {
    const share = BigInt(Math.round((Number(amountPaise) * weight) / total / 100)) * 100n;
    result.set(vehicleId, share);
    given += share;
    if (weight > heaviestWeight) {
      heaviest = vehicleId;
      heaviestWeight = weight;
    }
  }
  result.set(heaviest, result.get(heaviest)! + (amountPaise - given));
  return result;
}
