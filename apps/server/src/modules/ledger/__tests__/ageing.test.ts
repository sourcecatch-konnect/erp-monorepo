import { describe, expect, it } from "vitest";

import { bucketBills, bucketFor, type AgeingBillLite } from "../ageing.compute.js";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const asOf = d("2025-10-01");

describe("bucketFor", () => {
  it("a bill overdue by 45 days lands in 31–60, nowhere else", () => {
    expect(bucketFor(d("2025-08-17"), asOf)).toBe("d31_60"); // 45 days
  });

  it("bucket boundaries", () => {
    const cases: [string, ReturnType<typeof bucketFor>][] = [
      ["2025-10-15", "notDue"], // due in the future
      ["2025-10-01", "notDue"], // due today
      ["2025-09-30", "d0_30"], // 1 day
      ["2025-09-01", "d0_30"], // 30 days
      ["2025-08-31", "d31_60"], // 31 days
      ["2025-08-02", "d31_60"], // 60 days
      ["2025-08-01", "d61_90"], // 61 days
      ["2025-07-03", "d61_90"], // 90 days
      ["2025-07-02", "d90_plus"], // 91 days
      ["2024-01-01", "d90_plus"],
    ];
    for (const [due, bucket] of cases) {
      expect(bucketFor(d(due), asOf), `${due}`).toBe(bucket);
    }
  });
});

describe("bucketBills", () => {
  const names = new Map([
    ["whirlpool", "Whirlpool"],
    ["britannia", "Britannia"],
  ]);

  it("groups per customer, sums buckets, and totals reconcile", () => {
    const bills: AgeingBillLite[] = [
      // Whirlpool — one not-due bill
      { customerId: "whirlpool", billDate: d("2025-09-20"), dueDate: d("2025-10-20"), outstandingPaise: 25_000_00 },
      // Britannia — 0–30, 31–60, 90+
      { customerId: "britannia", billDate: d("2025-09-10"), dueDate: d("2025-09-15"), outstandingPaise: 10_000_00 },
      { customerId: "britannia", billDate: d("2025-08-01"), dueDate: d("2025-08-20"), outstandingPaise: 45_000_00 },
      { customerId: "britannia", billDate: d("2025-05-01"), dueDate: d("2025-05-15"), outstandingPaise: 12_000_00 },
      // a fully-paid bill contributes nothing
      { customerId: "britannia", billDate: d("2025-07-01"), dueDate: d("2025-07-10"), outstandingPaise: 0 },
    ];

    const { rows, totals } = bucketBills(bills, asOf, names);

    const britannia = rows.find((r) => r.customerId === "britannia")!;
    expect(britannia.buckets).toEqual({
      notDue: 0,
      d0_30: 10_000_00,
      d31_60: 45_000_00,
      d61_90: 0,
      d90_plus: 12_000_00,
    });
    expect(britannia.totalPaise).toBe(67_000_00);

    const whirlpool = rows.find((r) => r.customerId === "whirlpool")!;
    expect(whirlpool.buckets.notDue).toBe(25_000_00);
    expect(whirlpool.totalPaise).toBe(25_000_00);

    // grand totals == Σ rows
    expect(totals.totalPaise).toBe(92_000_00);
    expect(
      totals.notDue + totals.d0_30 + totals.d31_60 + totals.d61_90 + totals.d90_plus,
    ).toBe(totals.totalPaise);

    // each row total == Σ its own buckets
    for (const r of rows) {
      const sum =
        r.buckets.notDue +
        r.buckets.d0_30 +
        r.buckets.d31_60 +
        r.buckets.d61_90 +
        r.buckets.d90_plus;
      expect(sum).toBe(r.totalPaise);
    }
  });

  it("a bill with no due date is aged from its bill date", () => {
    const bills: AgeingBillLite[] = [
      { customerId: "x", billDate: d("2025-08-17"), dueDate: null, outstandingPaise: 1_000_00 },
    ];
    const { rows } = bucketBills(bills, asOf, new Map());
    expect(rows[0]!.buckets.d31_60).toBe(1_000_00);
  });

  it("rows are sorted by total desc and zero-total customers are dropped", () => {
    const bills: AgeingBillLite[] = [
      { customerId: "small", billDate: d("2025-09-20"), dueDate: d("2025-09-25"), outstandingPaise: 100 },
      { customerId: "big", billDate: d("2025-09-20"), dueDate: d("2025-09-25"), outstandingPaise: 9_000_00 },
      { customerId: "zero", billDate: d("2025-09-20"), dueDate: d("2025-09-25"), outstandingPaise: 0 },
    ];
    const { rows } = bucketBills(bills, asOf, new Map());
    expect(rows.map((r) => r.customerId)).toEqual(["big", "small"]);
  });
});
