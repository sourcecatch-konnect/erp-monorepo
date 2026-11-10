import { describe, expect, it } from "vitest";
import {
  ageClaims,
  daysOpen,
  routeLabel,
  summariseCost,
  type CostClaim,
} from "../claim.reports.compute.js";

const rs = (rupees: number) => BigInt(Math.round(rupees * 100));
const now = new Date("2026-11-06T10:00:00.000Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);

describe("ageClaims", () => {
  it("puts each open claim in one bucket, at the boundaries too", () => {
    const buckets = ageClaims(
      [0, 15, 16, 30, 31, 60, 61, 200].map((days) => ({
        createdAt: daysAgo(days),
        claimedAmountPaise: rs(1_000),
      })),
      now,
    );
    expect(buckets.map((b) => [b.key, b.count])).toEqual([
      ["D0_15", 2],
      ["D16_30", 2],
      ["D31_60", 2],
      ["D60_PLUS", 2],
    ]);
    expect(buckets[0]!.claimedAmountPaise).toBe(Number(rs(2_000)));
  });

  it("adds up to the open-claim count", () => {
    const claims = Array.from({ length: 37 }, (_, i) => ({
      createdAt: daysAgo(i * 3),
      claimedAmountPaise: rs(500),
    }));
    const total = ageClaims(claims, now).reduce((sum, b) => sum + b.count, 0);
    expect(total).toBe(claims.length);
  });

  it("counts whole days only", () => {
    expect(daysOpen(new Date(now.getTime() - 86_400_000 + 1), now)).toBe(0);
    expect(daysOpen(daysAgo(1), now)).toBe(1);
  });
});

const claim = (over: Partial<CostClaim>): CostClaim => ({
  settledAmountPaise: rs(10_000),
  recoveredAmountPaise: 0n,
  cause: "TRANSPORTER",
  customer: { id: "c1", name: "Acme" },
  transporter: { id: "t1", name: "Shree Roadways" },
  route: "Pune → Nagpur",
  ...over,
});

describe("summariseCost", () => {
  const claims = [
    claim({ settledAmountPaise: rs(35_000), recoveredAmountPaise: rs(35_000) }),
    claim({ settledAmountPaise: rs(10_000), recoveredAmountPaise: rs(2_000), cause: "LABOUR" }),
    claim({ settledAmountPaise: rs(8_000), cause: null, transporter: null }),
  ];

  it("totals reconcile with the plain sum of the claims, whatever the grouping", () => {
    for (const groupBy of ["cause", "transporter", "route", "customer"] as const) {
      const { rows, totals } = summariseCost(claims, groupBy);
      expect(totals).toEqual({
        claims: 3,
        settledAmountPaise: Number(rs(53_000)),
        recoveredAmountPaise: Number(rs(37_000)),
        netLossPaise: Number(rs(16_000)),
      });
      expect(rows.reduce((sum, row) => sum + row.netLossPaise, 0)).toBe(totals.netLossPaise);
      expect(rows.reduce((sum, row) => sum + row.claims, 0)).toBe(3);
    }
  });

  it("groups by cause, biggest net loss first, unassessed kept apart", () => {
    const { rows } = summariseCost(claims, "cause");
    expect(rows.map((row) => [row.label, row.netLossPaise])).toEqual([
      ["Labour", Number(rs(8_000))],
      ["Not assessed", Number(rs(8_000))],
      ["Transporter", 0],
    ]);
  });

  it("puts our own fleet's claims under one transporter row", () => {
    const { rows } = summariseCost(claims, "transporter");
    expect(rows.find((row) => row.key === "OWN_FLEET")?.claims).toBe(1);
  });
});

describe("routeLabel", () => {
  it("uses cities, falling back to branches", () => {
    expect(routeLabel({ fromCity: "Pune", toCity: "Nagpur", fromBranch: "PUN", toBranch: "NGP" })).toBe(
      "Pune → Nagpur",
    );
    expect(routeLabel({ fromCity: null, toCity: "Nagpur", fromBranch: "Pune", toBranch: "Nagpur BR" })).toBe(
      "Pune → Nagpur BR",
    );
  });
});
