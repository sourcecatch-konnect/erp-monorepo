import { describe, expect, it } from "vitest";
import {
  approvableFrom,
  canApproveMonth,
  computeSalaryLine,
  earnedSalaryPaise,
  employedDaysInMonth,
  monthBounds,
  previousMonth,
  splitAcrossSources,
  type LedgerMovement,
} from "../salary-run.compute.js";

const rs = (rupees: number) => BigInt(Math.round(rupees * 100));
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const move = (date: string, bucket: LedgerMovement["bucket"], owesRupees: number): LedgerMovement => ({
  voucherDate: d(date),
  bucket,
  owesPaise: rs(owesRupees),
});

const august = monthBounds("2026-08");
const line = (
  baseRupees: number,
  absentDays: number,
  movements: LedgerMovement[] = [],
  outstandingEarlierRunsPaise = 0n,
) =>
  computeSalaryLine({
    baseSalaryPaise: rs(baseRupees),
    absentDays,
    daysInMonth: august.daysInMonth,
    windowStart: august.monthStart,
    movements,
    outstandingEarlierRunsPaise,
  });

describe("monthBounds", () => {
  it("knows each month's calendar length", () => {
    expect(monthBounds("2026-08").daysInMonth).toBe(31);
    expect(monthBounds("2026-09").daysInMonth).toBe(30);
    expect(monthBounds("2027-02").daysInMonth).toBe(28);
    expect(monthBounds("2028-02").daysInMonth).toBe(29);
    expect(monthBounds("2026-08").monthEnd.toISOString().slice(0, 10)).toBe("2026-08-31");
  });

  it("rejects a malformed month", () => {
    expect(() => monthBounds("2026-13")).toThrow(/YYYY-MM/);
    expect(() => monthBounds("08-2026")).toThrow(/YYYY-MM/);
  });
});

describe("earnedSalaryPaise — the sheet's Act/Pble column", () => {
  it.each([
    [7000, 31, 7000],
    [7000, 30, 6774], // Mohammad Jasim Uddin
    [7000, 3, 677], // Basarat
    [7000, 15, 3387], // Sakim Khan
    [7000, 24, 5419], // Parmeshwar Patil
    [9000, 19, 5516], // MH19CY2551
    [12000, 21, 8129], // Sunil Kakade
  ])("₹%i for %i of 31 days = ₹%i", (base, present, expected) => {
    expect(earnedSalaryPaise(rs(base), present, 31)).toBe(rs(expected));
  });

  it("is zero for a driver absent all month", () => {
    expect(earnedSalaryPaise(rs(7000), 0, 31)).toBe(0n);
  });
});

describe("computeSalaryLine — August 2026 sheet", () => {
  it("Mangal Tayde: 7,000 − log slip 1,950 = 5,050", () => {
    const r = line(7000, 0, [move("2026-08-12", "LOG_SLIP", 1950)]);
    expect(r).toMatchObject({
      presentDays: 31,
      earnedPaise: rs(7000),
      logSlipBalancePaise: rs(1950),
      previousBalancePaise: 0n,
      netPaise: rs(5050),
    });
  });

  it("Parmeshwar Patil: 24 days → 5,419 − 2,365 = 3,054", () => {
    expect(line(7000, 7, [move("2026-08-20", "LOG_SLIP", 2365)]).netPaise).toBe(rs(3054));
  });

  it("Sunil Kakade: 8,129 − advance 8,000 − log slip 400 = −271 (he owes us)", () => {
    const r = line(12000, 10, [
      move("2026-08-05", "SALARY_ADVANCE", 8000),
      move("2026-08-25", "LOG_SLIP", 400),
    ]);
    expect(r.salaryAdvancePaise).toBe(rs(8000));
    expect(r.logSlipBalancePaise).toBe(rs(400));
    expect(r.netPaise).toBe(rs(-271));
  });

  it("Jasim: a ₹895 log slip payable already paid in cash adds nothing (6,774)", () => {
    const r = line(7000, 1, [
      move("2026-08-18", "LOG_SLIP", -895), // log slip: we owe him 895
      move("2026-08-18", "LOG_SLIP", 895), // Paid in cash
    ]);
    expect(r.logSlipBalancePaise).toBe(0n);
    expect(r.netPaise).toBe(rs(6774));
  });

  it("an unpaid log slip payable is paid through the salary", () => {
    expect(line(7000, 0, [move("2026-08-18", "LOG_SLIP", -895)]).netPaise).toBe(rs(7895));
  });
});

describe("computeSalaryLine — carry-over between months", () => {
  it("last month's −271 comes back as previous balance", () => {
    const r = line(12000, 0, [
      move("2026-07-31", "SALARY", -100), // July salary credited (earned 100)
      move("2026-07-10", "SALARY_ADVANCE", 371), // July advance → July net −271
    ]);
    expect(r.previousBalancePaise).toBe(rs(271));
    expect(r.salaryAdvancePaise).toBe(0n);
    expect(r.netPaise).toBe(rs(12000 - 271));
  });

  it("an advance entered late (dated last month) is recovered now, as previous balance", () => {
    const r = line(7000, 0, [
      move("2026-07-31", "SALARY", -7000),
      move("2026-08-01", "SALARY", 7000), // July salary paid on 1 Aug
      move("2026-07-28", "SALARY_ADVANCE", 1000), // entered after July's run
    ]);
    expect(r.previousBalancePaise).toBe(rs(1000));
    expect(r.netPaise).toBe(rs(6000));
  });

  it("an earlier run's unpaid net is not paid again here", () => {
    // July run approved (we owe 5,050) but not paid yet.
    const r = line(7000, 0, [move("2026-07-31", "SALARY", -5050)], rs(5050));
    expect(r.previousBalancePaise).toBe(0n);
    expect(r.netPaise).toBe(rs(7000));
  });

  it("a manual payment this month shows under other payments", () => {
    const r = line(7000, 0, [
      move("2026-08-03", "LOG_SLIP", -1188),
      move("2026-08-04", "OTHER", 1188), // paid manually instead of from the log slip
    ]);
    expect(r.otherPaymentsPaise).toBe(rs(1188));
    expect(r.netPaise).toBe(rs(7000));
  });

  it("the columns always add back up to the ledger figure", () => {
    const movements = [
      move("2026-06-30", "SALARY", -3000),
      move("2026-07-15", "OTHER", 500),
      move("2026-08-02", "SALARY_ADVANCE", 2000),
      move("2026-08-09", "LOG_SLIP", 750),
      move("2026-08-11", "OTHER", 300),
    ];
    const r = line(9000, 4, movements);
    const owes = movements.reduce((s, m) => s + m.owesPaise, 0n);
    expect(
      r.salaryAdvancePaise + r.logSlipBalancePaise + r.otherPaymentsPaise + r.previousBalancePaise,
    ).toBe(owes);
    expect(r.netPaise).toBe(r.earnedPaise - owes);
  });
});

describe("splitAcrossSources — pay salaries from several accounts", () => {
  const dues = [
    { driverId: "A", amountPaise: rs(8000) },
    { driverId: "B", amountPaise: rs(6000) },
    { driverId: "C", amountPaise: rs(4000) },
  ];

  it("one account pays everyone", () => {
    const pieces = splitAcrossSources(dues, [{ amountPaise: rs(18000) }]);
    expect(pieces).toHaveLength(3);
    expect(pieces.every((p) => p.sourceIndex === 0)).toBe(true);
  });

  it("cash ₹10,000 + bank ₹8,000: driver B is paid from both", () => {
    const pieces = splitAcrossSources(dues, [{ amountPaise: rs(10000) }, { amountPaise: rs(8000) }]);
    expect(pieces).toEqual([
      { driverId: "A", sourceIndex: 0, amountPaise: rs(8000) },
      { driverId: "B", sourceIndex: 0, amountPaise: rs(2000) },
      { driverId: "B", sourceIndex: 1, amountPaise: rs(4000) },
      { driverId: "C", sourceIndex: 1, amountPaise: rs(4000) },
    ]);
  });

  it("refuses accounts that don't add up to what is due", () => {
    expect(() => splitAcrossSources(dues, [{ amountPaise: rs(15000) }])).toThrow(/add up to/);
  });
});

describe("previousMonth — salary runs go in month order", () => {
  it("steps back one month, across the year", () => {
    expect(previousMonth("2026-11")).toBe("2026-10");
    expect(previousMonth("2027-01")).toBe("2026-12");
    expect(previousMonth("2026-03")).toBe("2026-02");
  });
});

describe("month-end approval", () => {
  it("opens on the month's last day, India time", () => {
    expect(approvableFrom("2026-10")).toBe("2026-10-31");
    expect(approvableFrom("2027-02")).toBe("2027-02-28");
    // 2 Oct — too early for October.
    expect(canApproveMonth("2026-10", new Date("2026-10-02T06:00:00.000Z"))).toBe(false);
    // 31 Oct 00:30 IST (30 Oct 19:00 UTC) — already allowed.
    expect(canApproveMonth("2026-10", new Date("2026-10-30T19:00:00.000Z"))).toBe(true);
    // 30 Oct 23:00 IST — still not.
    expect(canApproveMonth("2026-10", new Date("2026-10-30T17:30:00.000Z"))).toBe(false);
    // Any later month-end is fine.
    expect(canApproveMonth("2026-09", new Date("2026-10-02T06:00:00.000Z"))).toBe(true);
  });
});

describe("joining / leaving date (G4)", () => {
  const oct = monthBounds("2026-10");
  it("counts only the days employed in the month", () => {
    expect(employedDaysInMonth(oct, null, null)).toBe(31);
    expect(employedDaysInMonth(oct, d("2026-10-15"), null)).toBe(17); // joined 15 Oct
    expect(employedDaysInMonth(oct, null, d("2026-10-20"))).toBe(20); // left 20 Oct
    expect(employedDaysInMonth(oct, d("2026-10-05"), d("2026-10-10"))).toBe(6);
    expect(employedDaysInMonth(oct, d("2026-09-01"), d("2026-12-31"))).toBe(31);
    expect(employedDaysInMonth(oct, d("2026-11-02"), null)).toBe(0); // joins later
    expect(employedDaysInMonth(oct, null, d("2026-09-30"))).toBe(0); // left before
  });

  it("Ramesh joined 15 Oct: 10,000 × 17 ÷ 31 = 5,484", () => {
    const r = computeSalaryLine({
      baseSalaryPaise: rs(10000),
      absentDays: 0,
      daysInMonth: 31,
      employedDays: 17,
      windowStart: oct.monthStart,
      movements: [],
      outstandingEarlierRunsPaise: 0n,
    });
    expect(r.presentDays).toBe(17);
    expect(r.earnedPaise).toBe(rs(5484));
  });

  it("absent days are counted inside the employed days", () => {
    const base = {
      baseSalaryPaise: rs(10000),
      daysInMonth: 31,
      employedDays: 17,
      windowStart: oct.monthStart,
      movements: [],
      outstandingEarlierRunsPaise: 0n,
    };
    expect(computeSalaryLine({ ...base, absentDays: 2 }).presentDays).toBe(15);
    expect(() => computeSalaryLine({ ...base, absentDays: 18 })).toThrow(/employed only 17/);
  });
});

describe("computeSalaryLine — input checks", () => {
  it("refuses negative, fractional or too many absent days", () => {
    expect(() => line(7000, -1)).toThrow(/whole number/);
    expect(() => line(7000, 1.5)).toThrow(/whole number/);
    expect(() => line(7000, 32)).toThrow(/more than 31/);
  });
});
