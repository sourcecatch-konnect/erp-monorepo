import { describe, expect, it } from "vitest";
import { overlapMs, splitByWeight } from "../driver-salary-allocation.compute.js";

const rs = (rupees: number) => BigInt(Math.round(rupees * 100));
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const DAY = 86_400_000;
const octStart = d("2026-10-01");
const novStart = d("2026-11-01");

describe("overlapMs — time a journey spends inside the month", () => {
  it("clips a journey that started last month", () => {
    const span = { vehicleId: "A", start: d("2026-09-25"), end: d("2026-10-05") };
    expect(overlapMs(span, octStart, novStart, d("2026-12-01"))).toBe(4 * DAY);
  });

  it("clips a journey that runs into next month", () => {
    const span = { vehicleId: "A", start: d("2026-10-29"), end: d("2026-11-04") };
    expect(overlapMs(span, octStart, novStart, d("2026-12-01"))).toBe(3 * DAY);
  });

  it("runs an open journey until today", () => {
    const span = { vehicleId: "A", start: d("2026-10-10"), end: null };
    expect(overlapMs(span, octStart, novStart, d("2026-10-15"))).toBe(5 * DAY);
  });

  it("is zero for a journey outside the month", () => {
    const span = { vehicleId: "A", start: d("2026-09-01"), end: d("2026-09-20") };
    expect(overlapMs(span, octStart, novStart, d("2026-12-01"))).toBe(0);
  });
});

describe("splitByWeight — a driver's salary across his vehicles", () => {
  it("one vehicle all month gets the whole salary", () => {
    expect(splitByWeight(rs(9677), new Map([["MH12", 31]]))).toEqual(new Map([["MH12", rs(9677)]]));
  });

  it("splits by days driven: 20 days + 11 days of ₹10,000", () => {
    const parts = splitByWeight(rs(10000), new Map([["A", 20], ["B", 11]]));
    expect(parts.get("A")).toBe(rs(6452));
    expect(parts.get("B")).toBe(rs(3548));
  });

  it("always adds back up to the salary exactly", () => {
    const parts = splitByWeight(rs(10000), new Map([["A", 1], ["B", 1], ["C", 1]]));
    expect([...parts.values()].reduce((s, v) => s + v, 0n)).toBe(rs(10000));
  });

  it("charges nobody when the driver drove no vehicle", () => {
    expect(splitByWeight(rs(10000), new Map()).size).toBe(0);
    expect(splitByWeight(rs(10000), new Map([["A", 0]])).size).toBe(0);
  });
});
