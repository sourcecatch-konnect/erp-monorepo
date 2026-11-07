import { describe, expect, it } from "vitest";

import {
  chargeDetention,
  resolveApprovedDetention,
  resolveDetentionWindow,
  type DetentionSlabRules,
} from "../detention.engine.js";

/**
 * Every case here is a worked example from "Detailed DC Detention Working
 * Process". The numbers are the business's, not ours — if one of these fails,
 * the engine disagrees with the people who sign the broker's cheque.
 */

/** Dates in the spec are DD-MM-YY and mean IST calendar days. */
const ist = (ddmmyy: string, time = "00:00"): Date => {
  const [dd, mm, yy] = ddmmyy.split("-");
  return new Date(`20${yy}-${mm}-${dd}T${time}:00+05:30`);
};

const lr = (
  lrNumber: string,
  reported: string | null,
  unloaded: string | null,
) => ({
  lrNumber,
  reportedAt: reported ? ist(reported) : null,
  unloadingAt: unloaded ? ist(unloaded) : null,
});

describe("resolveDetentionWindow", () => {
  it("STEP 3 — takes the earlier of LDC date and report date", () => {
    const window = resolveDetentionWindow({
      ldcDate: ist("05-03-26"),
      reportDate: ist("06-03-26"),
      lrs: [lr("LR001", null, "10-03-26")],
    });
    expect(window.finalReportingAt).toEqual(ist("05-03-26"));
  });

  it("STEP 4 — takes the earliest LR reporting date", () => {
    const window = resolveDetentionWindow({
      ldcDate: null,
      reportDate: null,
      lrs: [
        lr("LR001", "06-03-26", "08-03-26"),
        lr("LR002", "04-03-26", "10-03-26"),
        lr("LR003", "05-03-26", "09-03-26"),
      ],
    });
    expect(window.finalReportingAt).toEqual(ist("04-03-26"));
  });

  it("STEP 5 — final reporting date is the earliest across both sources", () => {
    const window = resolveDetentionWindow({
      ldcDate: ist("05-03-26"),
      reportDate: ist("06-03-26"),
      lrs: [
        lr("LR001", "06-03-26", "08-03-26"),
        lr("LR002", "04-03-26", "10-03-26"),
        lr("LR003", "05-03-26", "09-03-26"),
      ],
    });
    expect(window.finalReportingAt).toEqual(ist("04-03-26"));
  });

  it("STEP 6 — takes the latest LR unloading date", () => {
    const window = resolveDetentionWindow({
      ldcDate: null,
      reportDate: null,
      lrs: [
        lr("LR001", "04-03-26", "08-03-26"),
        lr("LR002", "04-03-26", "10-03-26"),
        lr("LR003", "04-03-26", "09-03-26"),
      ],
    });
    expect(window.finalUnloadingAt).toEqual(ist("10-03-26"));
  });

  it("STEP 7 — detention days counts both end dates", () => {
    const window = resolveDetentionWindow({
      ldcDate: ist("05-03-26"),
      reportDate: ist("06-03-26"),
      lrs: [
        lr("LR001", "06-03-26", "08-03-26"),
        lr("LR002", "04-03-26", "10-03-26"),
        lr("LR003", "05-03-26", "09-03-26"),
      ],
    });
    // The spec's STEP 7 reads 6 here (a bare 10-03 minus 04-03). The business
    // counts both end dates, so it is 7 — see the note on
    // `resolveDetentionWindow`.
    expect(window.detentionDays).toBe(7);
  });

  it("counts IST calendar days, not UTC ones", () => {
    // 01:00 IST on the 10th is still 19:30 UTC on the 9th. Flooring in UTC
    // would report 6 days here instead of 7.
    const window = resolveDetentionWindow({
      ldcDate: null,
      reportDate: null,
      lrs: [lr("LR001", "04-03-26", "10-03-26")].map((row) => ({
        ...row,
        unloadingAt: ist("10-03-26", "01:00"),
      })),
    });
    expect(window.detentionDays).toBe(7);
  });

  it("reports missing dates instead of guessing", () => {
    const window = resolveDetentionWindow({
      ldcDate: ist("05-03-26"),
      reportDate: null,
      lrs: [lr("LR001", "04-03-26", null), lr("LR002", "05-03-26", null)],
    });
    expect(window.detentionDays).toBeNull();
    expect(window.lrsMissingUnloading).toEqual(["LR001", "LR002"]);
    expect(window.reason).toMatch(/unloading date/i);
  });

  it("flags an unloading date before the reporting date", () => {
    const window = resolveDetentionWindow({
      ldcDate: null,
      reportDate: null,
      lrs: [lr("LR001", "10-03-26", "04-03-26")],
    });
    expect(window.detentionDays).toBe(0);
    expect(window.reason).toMatch(/before the reporting date/i);
  });

  it("counts a same-day report and unload as one day", () => {
    const window = resolveDetentionWindow({
      ldcDate: null,
      reportDate: null,
      lrs: [lr("LR001", "04-03-26", "04-03-26")],
    });
    expect(window.detentionDays).toBe(1);
  });

  it("the Guwahati case — loaded 21st, reported 24th, unloaded 27th", () => {
    // The broker's clock runs from loading, so the LDC date wins over the
    // later LR reporting date and the span is 21st to 27th inclusive.
    const window = resolveDetentionWindow({
      ldcDate: ist("21-09-26"),
      reportDate: null,
      lrs: [lr("LR001", "24-09-26", "27-09-26")],
    });
    expect(window.finalReportingAt).toEqual(ist("21-09-26"));
    expect(window.detentionDays).toBe(7);

    // First and last day free leaves 5 chargeable days.
    const charge = chargeDetention({ window, slab: bipinSingh });
    expect(charge.chargeableUnits).toBe(5);
  });
});

/* ───────────────────────── slabs ───────────────────────── */

const rupees = (n: number): bigint => BigInt(n) * 100n;

/** STEP 10 — first day free, last day free, up to 2 days 1000, 3rd day on 1500. */
const bipinSingh: DetentionSlabRules = {
  basis: "DAY",
  firstDayFree: true,
  lastDayFree: true,
  freeHours: null,
  blockHours: null,
  bands: [
    { fromUnit: 1, toUnit: 2, ratePaise: rupees(1000) },
    { fromUnit: 3, toUnit: null, ratePaise: rupees(1500) },
  ],
};

/** STEP 11 — big truck: first and last day free, flat 1500/day after. */
const bigTruck: DetentionSlabRules = {
  basis: "DAY",
  firstDayFree: true,
  lastDayFree: true,
  freeHours: null,
  blockHours: null,
  bands: [{ fromUnit: 1, toUnit: null, ratePaise: rupees(1500) }],
};

/** STEP 12 — 407: first 24 hours free, every next 24 hours 1000. */
const smallTruck: DetentionSlabRules = {
  basis: "HOUR",
  firstDayFree: false,
  lastDayFree: false,
  freeHours: 24,
  blockHours: 24,
  bands: [{ fromUnit: 1, toUnit: null, ratePaise: rupees(1000) }],
};

/**
 * A window of exactly `days` detention days, as the spec's worked examples
 * count them — inclusively. "Total Days = 6" means reported on the 1st and
 * unloaded on the 6th, so the span is `days - 1` long.
 */
const windowOfDays = (days: number) =>
  resolveDetentionWindow({
    ldcDate: null,
    reportDate: null,
    lrs: [
      {
        lrNumber: "LR001",
        reportedAt: ist("01-03-26"),
        unloadingAt: new Date(
          ist("01-03-26").getTime() + (days - 1) * 86_400_000,
        ),
      },
    ],
  });

const windowOfHours = (hours: number) =>
  resolveDetentionWindow({
    ldcDate: null,
    reportDate: null,
    lrs: [
      {
        lrNumber: "LR001",
        reportedAt: ist("01-03-26"),
        unloadingAt: new Date(ist("01-03-26").getTime() + hours * 3_600_000),
      },
    ],
  });

describe("chargeDetention — day basis", () => {
  it("STEP 10 — 6 days on the Bipin Singh slab costs 5000", () => {
    const charge = chargeDetention({
      window: windowOfDays(6),
      slab: bipinSingh,
    });
    expect(charge.freeUnits).toBe(2);
    expect(charge.chargeableUnits).toBe(4);
    expect(charge.amountPaise).toBe(rupees(5000));
  });

  it("STEP 10 — breaks the charge down by tier", () => {
    const charge = chargeDetention({
      window: windowOfDays(6),
      slab: bipinSingh,
    });
    expect(charge.lines).toEqual([
      {
        label: "Days 1-2",
        units: 2,
        ratePaise: rupees(1000),
        amountPaise: rupees(2000),
      },
      {
        label: "Days 3-4",
        units: 2,
        ratePaise: rupees(1500),
        amountPaise: rupees(3000),
      },
    ]);
  });

  it("stacks tiers rather than picking the band the total falls in", () => {
    // A pick-one implementation would bill 4 x 1500 = 6000 here.
    const charge = chargeDetention({
      window: windowOfDays(6),
      slab: bipinSingh,
    });
    expect(charge.amountPaise).not.toBe(rupees(6000));
  });

  it("charges nothing when free days cover the whole detention", () => {
    const charge = chargeDetention({
      window: windowOfDays(2),
      slab: bipinSingh,
    });
    expect(charge.amountPaise).toBe(0n);
    expect(charge.lines).toEqual([]);
  });

  it("STEP 11 — big truck slab is flat after the two free days", () => {
    const charge = chargeDetention({ window: windowOfDays(6), slab: bigTruck });
    expect(charge.chargeableUnits).toBe(4);
    expect(charge.amountPaise).toBe(rupees(6000));
  });

  it("warns when the slab does not cover the whole detention", () => {
    const capped: DetentionSlabRules = {
      ...bigTruck,
      bands: [{ fromUnit: 1, toUnit: 2, ratePaise: rupees(1500) }],
    };
    const charge = chargeDetention({ window: windowOfDays(8), slab: capped });
    expect(charge.amountPaise).toBe(rupees(3000));
    expect(charge.warning).toMatch(/outside every rate band/i);
  });

  it("returns zero, not a crash, when the window is unresolved", () => {
    const charge = chargeDetention({
      window: resolveDetentionWindow({
        ldcDate: null,
        reportDate: null,
        lrs: [],
      }),
      slab: bipinSingh,
    });
    expect(charge.amountPaise).toBe(0n);
    expect(charge.warning).toBeTruthy();
  });
});

describe("chargeDetention — hour basis", () => {
  it("STEP 14 — 25.95 hours costs one 1000 block", () => {
    const charge = chargeDetention({
      window: windowOfHours(25.95),
      slab: smallTruck,
    });
    expect(charge.chargeableUnits).toBe(1);
    expect(charge.amountPaise).toBe(rupees(1000));
  });

  it("the spec's other reading of STEP 14 (32.75h) bills the same block", () => {
    // The sheet's own arithmetic disagrees with itself (10.8 + 21.95 = 32.75,
    // not 25.95). Both land inside the first chargeable block, so the answer
    // is 1000 either way — worth pinning so the ambiguity cannot regress.
    const charge = chargeDetention({
      window: windowOfHours(32.75),
      slab: smallTruck,
    });
    expect(charge.amountPaise).toBe(rupees(1000));
  });

  it("charges nothing inside the free window", () => {
    const charge = chargeDetention({
      window: windowOfHours(23.5),
      slab: smallTruck,
    });
    expect(charge.amountPaise).toBe(0n);
  });

  it("bills a part block as a whole block", () => {
    const charge = chargeDetention({
      window: windowOfHours(48.25),
      slab: smallTruck,
    });
    expect(charge.chargeableUnits).toBe(2);
    expect(charge.amountPaise).toBe(rupees(2000));
  });
});

/**
 * L0-1 / audit D-14 — the broker's claim against the slab.
 *
 * The case that matters is the absent one. `claimedDetentionPaise` used to
 * ride on a Zod field defaulting to `0n`, so a request that simply omitted it
 * paid the broker nothing. Absent and zero are different facts.
 */
describe("resolveApprovedDetention", () => {
  const slab = rupees(5000);

  it("pays the slab when no claim was filed (undefined) — D-14 regression", () => {
    expect(resolveApprovedDetention(undefined, slab)).toEqual({
      approvedPaise: slab,
      claimFiled: false,
    });
  });

  it("pays the slab when no claim was filed (null)", () => {
    expect(resolveApprovedDetention(null, slab)).toEqual({
      approvedPaise: slab,
      claimFiled: false,
    });
  });

  it("honours a filed claim of zero as zero, not as 'no claim'", () => {
    expect(resolveApprovedDetention(0n, slab)).toEqual({
      approvedPaise: 0n,
      claimFiled: true,
    });
  });

  it("pays a claim lower than the slab", () => {
    expect(resolveApprovedDetention(rupees(2000), slab)).toEqual({
      approvedPaise: rupees(2000),
      claimFiled: true,
    });
  });

  it("caps a claim above the slab at the slab", () => {
    expect(resolveApprovedDetention(rupees(9000), slab)).toEqual({
      approvedPaise: slab,
      claimFiled: true,
    });
  });

  it("pays the slab when the claim equals it", () => {
    expect(resolveApprovedDetention(slab, slab)).toEqual({
      approvedPaise: slab,
      claimFiled: true,
    });
  });

  it("pays nothing when the slab is zero, however much is claimed", () => {
    expect(resolveApprovedDetention(rupees(3000), 0n)).toEqual({
      approvedPaise: 0n,
      claimFiled: true,
    });
  });

  it("pays nothing when the slab is zero and no claim was filed", () => {
    expect(resolveApprovedDetention(undefined, 0n)).toEqual({
      approvedPaise: 0n,
      claimFiled: false,
    });
  });
});
