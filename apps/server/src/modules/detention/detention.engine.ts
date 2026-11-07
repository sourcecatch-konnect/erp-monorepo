/**
 * DC detention calculation — pure functions, no database, no I/O.
 *
 * Two independent steps, deliberately kept separate so each can be tested
 * against the worked examples in "Detailed DC Detention Working Process":
 *
 *   1. `resolveDetentionWindow` — turn a challan and its LRs into a single
 *      reporting date, a single unloading date, and the gap between them.
 *   2. `chargeDetention` — turn that gap into money using a broker's slab.
 *
 * Everything here works on plain values. The service layer loads the rows and
 * hands them in; nothing in this file knows what Prisma is.
 */

/** Money is paise everywhere in this codebase (see schema.prisma). */
export type Paise = bigint;

/* ────────────────────── what the broker is paid ────────────────────── */

export type ApprovedDetention = {
  /** The figure that will actually be paid and posted. */
  approvedPaise: Paise;
  /** Whether the broker filed a claim at all. A filed claim of zero is still
   *  a filed claim — that is the whole point of the distinction. */
  claimFiled: boolean;
};

/**
 * Reconcile the broker's claim against the slab.
 *
 * The business pays whichever is lower, so a claim can only ever reduce what
 * is paid, never raise it above the rate card the business agreed.
 *
 * The important case is the absent one. `claimPaise` is `null`/`undefined`
 * when the broker filed no claim, and then **the slab stands** — it is not
 * treated as a claim of zero. Before this function existed the caller read a
 * Zod field that defaulted to `0n`, so a request that simply omitted the
 * field paid the broker no detention at all even when the slab priced it in
 * thousands (audit D-14). Absent and zero are different facts and are kept
 * different here.
 *
 * A claim of exactly zero is honoured as zero: the broker said they are owed
 * nothing, and that is their claim to make.
 */
export const resolveApprovedDetention = (
  claimPaise: Paise | null | undefined,
  slabPaise: Paise,
): ApprovedDetention =>
  claimPaise == null
    ? { approvedPaise: slabPaise, claimFiled: false }
    : {
        approvedPaise: claimPaise < slabPaise ? claimPaise : slabPaise,
        claimFiled: true,
      };

export type DetentionBasis = "DAY" | "HOUR";

/**
 * One tier of a slab. Tiers stack: a 4-day charge against
 * `[{1..2 @1000}, {3..null @1500}]` costs 2x1000 + 2x1500, it does NOT pick
 * the single band 4 falls into. (Spec STEP 10.)
 */
export type SlabBand = {
  /** 1-based, inclusive. Counted over *chargeable* units, after free ones. */
  fromUnit: number;
  /** Inclusive. `null` = open-ended ("from the 3rd day"). */
  toUnit: number | null;
  /** Charged per unit inside this tier. */
  ratePaise: Paise;
};

export type DetentionSlabRules = {
  basis: DetentionBasis;
  /** DAY basis only. Both can apply at once — they are separate rules. */
  firstDayFree: boolean;
  lastDayFree: boolean;
  /** HOUR basis only: the free window before the first chargeable block. */
  freeHours: number | null;
  /** HOUR basis only: size of a chargeable block. Spec uses 24h throughout. */
  blockHours: number | null;
  bands: SlabBand[];
};

/* ────────────────────────── date window ────────────────────────── */

/**
 * India Standard Time, in minutes. Detention is counted in local calendar
 * days: a truck that reported at 02:00 IST reported *that* day, but that
 * instant is the previous day in UTC. Flooring in UTC would silently lose a
 * day on every early-morning report, so the offset is explicit and overridable
 * rather than inherited from the server's clock.
 */
export const IST_OFFSET_MINUTES = 330;

export type LRWindowInput = {
  /** For diagnostics — which LR contributed the winning date. */
  lrNumber: string;
  reportedAt: Date | null;
  unloadingAt: Date | null;
};

export type DetentionWindowInput = {
  /** The challan's own date (spec: "LDC Date"). */
  ldcDate: Date | null;
  /** The separately recorded report date, when there is one. */
  reportDate: Date | null;
  lrs: LRWindowInput[];
  /** Defaults to IST. Pass a different offset only for tests or another zone. */
  offsetMinutes?: number;
};

export type DetentionWindow = {
  finalReportingAt: Date | null;
  finalUnloadingAt: Date | null;
  /** Calendar days the truck was held, counting both end dates. `null` when
   *  either date is unknown. */
  detentionDays: number | null;
  /** Hours between the two instants, for HOUR-basis slabs. */
  detentionHours: number | null;
  /** LRs with no unloading date — they cannot extend the window. */
  lrsMissingUnloading: string[];
  /** LRs with no reporting date. */
  lrsMissingReporting: string[];
  /** Plain-language note when the window could not be resolved. */
  reason: string | null;
};

const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;

/** Calendar-day index in the given zone, so two instants on the same local day
 *  always subtract to 0 regardless of the time of day. */
const localDayIndex = (date: Date, offsetMinutes: number): number =>
  Math.floor((date.getTime() + offsetMinutes * 60_000) / MS_PER_DAY);

const earliest = (dates: Date[]): Date | null =>
  dates.length === 0
    ? null
    : dates.reduce((min, d) => (d.getTime() < min.getTime() ? d : min));

const latest = (dates: Date[]): Date | null =>
  dates.length === 0
    ? null
    : dates.reduce((max, d) => (d.getTime() > max.getTime() ? d : max));
/**
 * Spec STEPS 3-7 and FINAL CORE BUSINESS LOGIC:
 *
 *   Final Reporting Date = earliest of (LDC date, report date, every LR's
 *                          reporting date)
 *   Final Unloading Date = latest of (every LR's unloading date)
 *   Detention Days       = the calendar days the truck was held, counted
 *                          INCLUSIVELY of both ends
 *
 * The clock starts when the *first* LR on the challan reported and stops when
 * the *last* one finished unloading — one truck is held for the whole span,
 * however many consignments it carried.
 *
 * NOTE — deliberate deviation from the written spec. STEP 7 gives
 * `Detention Days = Final Unloading Date - Final Reporting Date`, i.e. the
 * bare gap: its example 04-03 to 10-03 reads 6 days. The business counts the
 * dates themselves, so that same span is 7 days (04,05,06,07,08,09,10) and a
 * truck reported and unloaded on one day is held for 1 day, not 0. Confirmed
 * with the business on 2026-11-04; the spec document is to be amended to
 * match. Do not "fix" this back to a bare subtraction.
 */
export const resolveDetentionWindow = (
  input: DetentionWindowInput,
): DetentionWindow => {
  const offsetMinutes = input.offsetMinutes ?? IST_OFFSET_MINUTES;

  const lrsMissingReporting = input.lrs
    .filter((lr) => !lr.reportedAt)
    .map((lr) => lr.lrNumber);
  const lrsMissingUnloading = input.lrs
    .filter((lr) => !lr.unloadingAt)
    .map((lr) => lr.lrNumber);

  const reportingCandidates: Date[] = [
    input.ldcDate,
    input.reportDate,
    ...input.lrs.map((lr) => lr.reportedAt),
  ].filter((d): d is Date => d instanceof Date);

  const unloadingCandidates: Date[] = input.lrs
    .map((lr) => lr.unloadingAt)
    .filter((d): d is Date => d instanceof Date);

  const finalReportingAt = earliest(reportingCandidates);
  const finalUnloadingAt = latest(unloadingCandidates);

  if (!finalReportingAt || !finalUnloadingAt) {
    return {
      finalReportingAt,
      finalUnloadingAt,
      detentionDays: null,
      detentionHours: null,
      lrsMissingReporting,
      lrsMissingUnloading,
      reason: !finalReportingAt
        ? "No reporting date on the challan or any of its LRs"
        : "No LR on this challan has an unloading date yet",
    };
  }

  // Inclusive of both end dates: 04-03 to 10-03 is 7 days, and a truck
  // reported and unloaded on the same day is held for 1. See the note on
  // `resolveDetentionWindow`.
  const detentionDays = Math.max(
    localDayIndex(finalUnloadingAt, offsetMinutes) -
      localDayIndex(finalReportingAt, offsetMinutes) +
      1,
    0,
  );
  const detentionHours = Math.max(
    (finalUnloadingAt.getTime() - finalReportingAt.getTime()) / MS_PER_HOUR,
    0,
  );

  return {
    finalReportingAt,
    finalUnloadingAt,
    detentionDays,
    detentionHours,
    lrsMissingReporting,
    lrsMissingUnloading,
    // An unloading date earlier than the reporting date is clamped to zero
    // above rather than rejected — bad data should not fail the whole screen,
    // but it is worth surfacing.
    reason:
      finalUnloadingAt.getTime() < finalReportingAt.getTime()
        ? "Unloading date is before the reporting date — check the LR dates"
        : null,
  };
};

/* ────────────────────────── charging ────────────────────────── */

export type ChargeLine = {
  /** Human label for the breakdown table, e.g. "Days 1-2". */
  label: string;
  units: number;
  ratePaise: Paise;
  amountPaise: Paise;
};

export type DetentionCharge = {
  amountPaise: Paise;
  /** Units the slab charged for, after free days/hours were removed. */
  chargeableUnits: number;
  /** Units waived by firstDayFree / lastDayFree / freeHours. */
  freeUnits: number;
  lines: ChargeLine[];
  /** Set when a slab leaves part of the duration uncovered by any band. */
  warning: string | null;
};

const EMPTY_CHARGE = (reason: string | null): DetentionCharge => ({
  amountPaise: 0n,
  chargeableUnits: 0,
  freeUnits: 0,
  lines: [],
  warning: reason,
});

/** Bands in ascending order, so tiers are consumed from the bottom up. */
const sortedBands = (bands: SlabBand[]): SlabBand[] =>
  [...bands].sort((a, b) => a.fromUnit - b.fromUnit);

/**
 * Spread `units` chargeable units across stacked tiers.
 *
 * `fromUnit`/`toUnit` are positions in the chargeable run, so a band of
 * 1..2 bills the first two chargeable units whether or not any free days were
 * taken off the front.
 */
const applyBands = (
  units: number,
  bands: SlabBand[],
): {
  lines: ChargeLine[];
  amountPaise: Paise;
  uncovered: number;
} => {
  const lines: ChargeLine[] = [];
  let amountPaise = 0n;
  let covered = 0;

  for (const band of sortedBands(bands)) {
    if (covered >= units) break;
    // Where this band starts and ends within the chargeable run.
    const start = Math.max(band.fromUnit, covered + 1);
    const end = band.toUnit === null ? units : Math.min(band.toUnit, units);
    const count = end - start + 1;
    if (count <= 0) continue;

    const lineAmount = BigInt(count) * band.ratePaise;
    lines.push({
      label: count === 1 ? `Unit ${start}` : `Units ${start}-${end}`,
      units: count,
      ratePaise: band.ratePaise,
      amountPaise: lineAmount,
    });
    amountPaise += lineAmount;
    covered = end;
  }

  return { lines, amountPaise, uncovered: Math.max(units - covered, 0) };
};

export type ChargeInput = {
  window: DetentionWindow;
  slab: DetentionSlabRules;
};

/**
 * Spec STEPS 10-14. Day basis:
 *
 *   6 days, first free, last free      -> 4 chargeable
 *   bands [1-2 @1000, 3+ @1500]        -> 2x1000 + 2x1500 = 5000
 *
 * Hour basis (STEP 12/14): the free window is taken off the elapsed hours and
 * whatever remains is billed in whole blocks, so any part of a block costs a
 * full block.
 */
export const chargeDetention = ({
  window,
  slab,
}: ChargeInput): DetentionCharge => {
  if (slab.bands.length === 0) {
    return EMPTY_CHARGE("Slab has no rate bands configured");
  }

  if (slab.basis === "HOUR") {
    if (window.detentionHours === null) {
      return EMPTY_CHARGE(window.reason ?? "Detention window is unknown");
    }
    const freeHours = slab.freeHours ?? 0;
    const blockHours = slab.blockHours ?? 24;
    if (blockHours <= 0) {
      return EMPTY_CHARGE("Slab block size must be greater than zero");
    }
    const billableHours = window.detentionHours - freeHours;
    if (billableHours <= 0) {
      return {
        amountPaise: 0n,
        chargeableUnits: 0,
        freeUnits: 1,
        lines: [],
        warning: null,
      };
    }
    // Part of a block costs a whole block — the truck was held into it.
    const blocks = Math.ceil(billableHours / blockHours);
    const { lines, amountPaise, uncovered } = applyBands(blocks, slab.bands);
    return {
      amountPaise,
      chargeableUnits: blocks,
      freeUnits: freeHours > 0 ? 1 : 0,
      lines: lines.map((line) => ({
        ...line,
        label: line.label.replace("Unit", `${blockHours}h block`),
      })),
      warning:
        uncovered > 0
          ? `${uncovered} block(s) fall outside every rate band — extend the slab`
          : null,
    };
  }

  if (window.detentionDays === null) {
    return EMPTY_CHARGE(window.reason ?? "Detention window is unknown");
  }

  // Free days come off the total before any band applies. They are two
  // separate rules, so a one-day detention with both set is fully free.
  const freeUnits = (slab.firstDayFree ? 1 : 0) + (slab.lastDayFree ? 1 : 0);
  const chargeableUnits = Math.max(window.detentionDays - freeUnits, 0);
  if (chargeableUnits === 0) {
    return {
      amountPaise: 0n,
      chargeableUnits: 0,
      freeUnits: Math.min(freeUnits, window.detentionDays),
      lines: [],
      warning: null,
    };
  }

  const { lines, amountPaise, uncovered } = applyBands(
    chargeableUnits,
    slab.bands,
  );
  return {
    amountPaise,
    chargeableUnits,
    freeUnits,
    lines: lines.map((line) => ({
      ...line,
      label: line.label.replace("Units", "Days").replace("Unit", "Day"),
    })),
    warning:
      uncovered > 0
        ? `${uncovered} day(s) fall outside every rate band — extend the slab`
        : null,
  };
};
