import { describe, expect, it } from "vitest";

import { fyCodeFor } from "../../_shared/doc-number.js";
import { reversalPeriodFor } from "../reversal-date.js";

/**
 * Audit D-5, decision Q16.
 *
 * The defect was a *contradiction*: the contra carried today's `voucherDate`
 * but the original's `fyCode`, so a date-filtered report and an FY-filtered
 * report disagreed about when the reversal happened.
 *
 * Q16 confirmed **Option 2** — the contra is dated the day it is made. The
 * first test below holds under any of the three options that were on the
 * table and is the real regression guard: `fyCode` must always be the
 * financial year of the date on the voucher. The rest pin Option 2 down so a
 * future policy change shows up as a failing test rather than silent drift.
 */

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("reversalPeriodFor", () => {
  it("never lets fyCode contradict voucherDate — the D-5 invariant", () => {
    const originals = [
      { voucherDate: d("2026-04-01"), fyCode: "26-27" },
      { voucherDate: d("2026-03-31"), fyCode: "25-26" },
      { voucherDate: d("2025-12-15"), fyCode: "25-26" },
      { voucherDate: d("2024-06-30"), fyCode: "24-25" },
    ];
    const nows = [d("2026-11-06"), d("2026-03-31"), d("2026-04-01")];
    for (const original of originals) {
      for (const now of nows) {
        const result = reversalPeriodFor(original, now);
        expect(fyCodeFor(result.voucherDate)).toBe(result.fyCode);
      }
    }
  });

  it("dates the contra today, not on the original (Q16 Option 2)", () => {
    const original = { voucherDate: d("2026-09-10"), fyCode: "26-27" };
    const now = d("2026-11-06");
    expect(reversalPeriodFor(original, now)).toEqual({
      voucherDate: now,
      fyCode: "26-27",
    });
  });

  it("keeps a prior-year reversal in the CURRENT year — reported history never moves", () => {
    // The original sits in FY 25-26; the reversal is made in FY 26-27 and
    // stays there. The audit link is JournalEntry.reversesId, not the date.
    const original = { voucherDate: d("2025-08-20"), fyCode: "25-26" };
    const now = d("2026-11-06");
    expect(reversalPeriodFor(original, now)).toEqual({
      voucherDate: now,
      fyCode: "26-27",
    });
  });

  it("follows the 31 March / 1 April boundary by the reversal date", () => {
    const original = { voucherDate: d("2025-08-20"), fyCode: "25-26" };
    expect(reversalPeriodFor(original, d("2026-03-31")).fyCode).toBe("25-26");
    expect(reversalPeriodFor(original, d("2026-04-01")).fyCode).toBe("26-27");
  });

  it("depends on `now`, not on the original's period", () => {
    const march = { voucherDate: d("2026-03-01"), fyCode: "25-26" };
    const october = { voucherDate: d("2026-10-01"), fyCode: "26-27" };
    const now = d("2026-11-06");
    expect(reversalPeriodFor(march, now)).toEqual(
      reversalPeriodFor(october, now),
    );
  });
});
