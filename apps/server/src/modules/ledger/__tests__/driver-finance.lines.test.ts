import { describe, expect, it } from "vitest";

import {
  buildDriverMoneyOutLines,
  buildSalaryRunLines,
} from "../driver-finance.lines.js";

const sum = (lines: { debitPaise: bigint; creditPaise: bigint }[]) => ({
  debit: lines.reduce((s, l) => s + l.debitPaise, 0n),
  credit: lines.reduce((s, l) => s + l.creditPaise, 0n),
});

describe("buildDriverMoneyOutLines", () => {
  it("debits the driver and credits the funding ledger (₹8,000 salary advance)", () => {
    const lines = buildDriverMoneyOutLines({
      driverLedgerId: "drv-sunil",
      fundingLedgerId: "cash-ho",
      amountPaise: 800_000n,
      narration: "Salary advance",
    });

    expect(lines).toEqual([
      { ledgerId: "drv-sunil", debitPaise: 800_000n, creditPaise: 0n, narration: "Salary advance" },
      { ledgerId: "cash-ho", debitPaise: 0n, creditPaise: 800_000n, narration: "Salary advance" },
    ]);
    const totals = sum(lines);
    expect(totals.debit).toBe(totals.credit);
  });

  it("rejects a zero or negative amount", () => {
    const base = { driverLedgerId: "d", fundingLedgerId: "f", narration: "x" };
    expect(() => buildDriverMoneyOutLines({ ...base, amountPaise: 0n })).toThrow(/greater than zero/);
    expect(() => buildDriverMoneyOutLines({ ...base, amountPaise: -1n })).toThrow(/greater than zero/);
  });

  it("rejects paying a driver from his own ledger", () => {
    expect(() =>
      buildDriverMoneyOutLines({
        driverLedgerId: "same",
        fundingLedgerId: "same",
        amountPaise: 100n,
        narration: "x",
      }),
    ).toThrow(/must be different/);
  });
});

describe("buildSalaryRunLines", () => {
  // Earned amounts from the August 2026 sheet (Act/Pble column).
  const august = [
    { driverId: "mangal", driverLedgerId: "L-mangal", earnedPaise: 700_000n }, // 31/31 days
    { driverId: "jasim", driverLedgerId: "L-jasim", earnedPaise: 677_400n }, // 30/31 days
    { driverId: "sunil", driverLedgerId: "L-sunil", earnedPaise: 812_900n }, // 21/31 days of 12,000
  ];

  it("posts one balanced journal: Dr salary expense total, Cr each driver", () => {
    const lines = buildSalaryRunLines({
      expenseLedgerId: "DRIVER_SALARY_EXPENSE",
      narration: "Driver salary Aug 2026",
      lines: august,
    });

    expect(lines[0]).toMatchObject({
      ledgerId: "DRIVER_SALARY_EXPENSE",
      debitPaise: 2_190_300n,
      creditPaise: 0n,
    });
    expect(lines.slice(1).map((l) => [l.ledgerId, l.creditPaise])).toEqual([
      ["L-mangal", 700_000n],
      ["L-jasim", 677_400n],
      ["L-sunil", 812_900n],
    ]);
    const totals = sum(lines);
    expect(totals.debit).toBe(totals.credit);
  });

  it("skips a driver who earned nothing (absent all month)", () => {
    const lines = buildSalaryRunLines({
      expenseLedgerId: "EXP",
      narration: "x",
      lines: [
        ...august,
        { driverId: "basarat", driverLedgerId: "L-basarat", earnedPaise: 0n },
      ],
    });
    expect(lines.map((l) => l.ledgerId)).not.toContain("L-basarat");
    expect(lines).toHaveLength(4);
  });

  it("refuses a run where nobody earned anything", () => {
    expect(() =>
      buildSalaryRunLines({
        expenseLedgerId: "EXP",
        narration: "x",
        lines: [{ driverId: "a", driverLedgerId: "L-a", earnedPaise: 0n }],
      }),
    ).toThrow(/Nothing to post/);
  });

  it("refuses a negative earned amount", () => {
    expect(() =>
      buildSalaryRunLines({
        expenseLedgerId: "EXP",
        narration: "x",
        lines: [{ driverId: "a", driverLedgerId: "L-a", earnedPaise: -5n }],
      }),
    ).toThrow(/cannot be negative/);
  });

  it("refuses the same driver twice in one run", () => {
    expect(() =>
      buildSalaryRunLines({
        expenseLedgerId: "EXP",
        narration: "x",
        lines: [august[0]!, august[0]!],
      }),
    ).toThrow(/appears twice/);
  });
});
