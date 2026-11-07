import { describe, expect, it } from "vitest";

/**
 * L4 — the DC approval's heads reaching the payment slip.
 *
 * Before this, `approvedParkingPaise` and friends were captured on the
 * approval and then ignored: an approver could allow the broker ₹2,000 of
 * parking and he would never be paid it. These cases pin which side of the
 * line each head falls on, because getting one backwards pays or recovers
 * money in the wrong direction.
 *
 * Mirrors `recalcSlipTotals`'s LDC_BROKER branch in vendor-payment.route.ts.
 */

const rupees = (n: number): bigint => BigInt(n) * 100n;

type Line = {
  freightPaise: bigint;
  detentionPaise: bigint;
  advancePaise: bigint;
  tdsPaise: bigint;
  damagePaise: bigint;
  parkingPaise: bigint;
  labourPaise: bigint;
  otherPaise: bigint;
  shortagePaise: bigint;
};

const line = (over: Partial<Line> = {}): Line => ({
  freightPaise: rupees(10000),
  detentionPaise: rupees(1000),
  advancePaise: rupees(5000),
  tdsPaise: 0n,
  damagePaise: 0n,
  parkingPaise: 0n,
  labourPaise: 0n,
  otherPaise: 0n,
  shortagePaise: 0n,
  ...over,
});

/** The heads the broker charges — these raise the gross, and so the TDS base. */
const grossOf = (l: Line) =>
  l.freightPaise +
  l.detentionPaise +
  l.parkingPaise +
  l.labourPaise +
  l.otherPaise;

/** The heads recovered from him, plus what he already holds. */
const deductionsOf = (l: Line) =>
  l.advancePaise + l.tdsPaise + l.damagePaise + l.shortagePaise;

const netOf = (l: Line) => grossOf(l) - deductionsOf(l);

describe("LDC deduction heads", () => {
  it("pays freight plus detention less the advance when no head is ruled", () => {
    expect(netOf(line())).toBe(rupees(6000));
  });

  it.each(["parkingPaise", "labourPaise", "otherPaise"] as const)(
    "adds %s to what the broker is paid",
    (key) => {
      const withHead = line({ [key]: rupees(500) } as Partial<Line>);
      expect(netOf(withHead) - netOf(line())).toBe(rupees(500));
    },
  );

  it.each(["damagePaise", "shortagePaise"] as const)(
    "recovers %s from the broker",
    (key) => {
      const withHead = line({ [key]: rupees(500) } as Partial<Line>);
      expect(netOf(line()) - netOf(withHead)).toBe(rupees(500));
    },
  );

  it("raises the TDS base by the heads he charges, not the ones recovered", () => {
    const charged = line({
      parkingPaise: rupees(500),
      labourPaise: rupees(300),
    });
    expect(grossOf(charged)).toBe(rupees(11800));

    const recovered = line({
      damagePaise: rupees(500),
      shortagePaise: rupees(300),
    });
    expect(grossOf(recovered)).toBe(grossOf(line()));
  });

  it("nets every head together", () => {
    const all = line({
      parkingPaise: rupees(200),
      labourPaise: rupees(300),
      otherPaise: rupees(100),
      damagePaise: rupees(400),
      shortagePaise: rupees(600),
      tdsPaise: rupees(116),
    });
    // 10000 + 1000 + 200 + 300 + 100 = 11600 gross
    // 5000 + 116 + 400 + 600        =  6116 deductions
    expect(grossOf(all)).toBe(rupees(11600));
    expect(deductionsOf(all)).toBe(rupees(6116));
    expect(netOf(all)).toBe(rupees(5484));
  });
});
