/* ------------------------------------------------------------------ */
/* Chain validation — pure, no DB import, so it's unit-testable        */
/* without a live database connection.                                */
/* ------------------------------------------------------------------ */

export type PrevLeg = {
  sequenceNo: number | null;
  toCityId: string | null;
  toCityName: string | null;
  closingKm: number | null;
  endDateTime: Date | null;
};

export type NextLegInput = {
  fromCityId: string;
  fromCityName: string;
  openingKm: number;
  startDateTime?: Date;
};

/**
 * Backend-enforced continuity rules between consecutive legs (never UI-only):
 *   next fromCity   = previous toCity
 *   next openingKm  = previous closingKm + 1
 *   next start time > previous close time
 * Returns human-readable violations; the route requires an exception reason
 * plus `vehicle_journey.override_chain` to proceed despite them.
 */
export const chainViolations = (
  prev: PrevLeg,
  next: NextLegInput,
): string[] => {
  const violations: string[] = [];

  if (prev.toCityId && next.fromCityId !== prev.toCityId) {
    violations.push(
      `Leg starts from ${next.fromCityName} but the previous leg ended at ${prev.toCityName}`,
    );
  }
  if (prev.closingKm !== null && next.openingKm !== prev.closingKm + 1) {
    violations.push(
      `Opening KM ${next.openingKm} breaks continuity — expected ${prev.closingKm + 1} (previous closing KM + 1)`,
    );
  }
  if (
    prev.endDateTime &&
    next.startDateTime &&
    next.startDateTime <= prev.endDateTime
  ) {
    violations.push("Start time must be after the previous leg's close time");
  }

  return violations;
};

/** Journey statuses that block starting another journey for the same vehicle/driver. */
export const OPEN_JOURNEY_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "RETURNED",
  "READY_FOR_LOGSLIP",
  "REOPENED",
] as const;
