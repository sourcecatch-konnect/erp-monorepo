import { afterEach, describe, expect, it } from "vitest";
import { claimHighValuePaise, claimStaleLimits } from "../claim.config.js";
import { isHighValue, staleDedupeKey, staleReminder } from "../claim.alerts.compute.js";

const now = new Date("2026-11-06T09:00:00.000Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);
const limits = { pendingDays: 7, activeDays: 30 };

describe("staleReminder", () => {
  it("reminds about a claim pending 7 days or more, not before", () => {
    expect(staleReminder({ status: "PENDING", createdAt: daysAgo(6), activeSince: null }, now, limits)).toBeNull();
    expect(staleReminder({ status: "PENDING", createdAt: daysAgo(7), activeSince: null }, now, limits)).toEqual({
      days: 7,
      statusLabel: "pending assessment",
    });
  });

  it("counts an active claim from when it was assessed", () => {
    // Raised 40 days ago, assessed 10 days ago: not stale yet.
    expect(
      staleReminder({ status: "ACTIVE", createdAt: daysAgo(40), activeSince: daysAgo(10) }, now, limits),
    ).toBeNull();
    expect(
      staleReminder({ status: "ACTIVE", createdAt: daysAgo(40), activeSince: daysAgo(31) }, now, limits),
    ).toEqual({ days: 31, statusLabel: "assessed but not settled" });
  });

  it("never reminds about a settled, rejected or cancelled claim", () => {
    for (const status of ["SETTLED", "REJECTED", "CANCELLED"])
      expect(staleReminder({ status, createdAt: daysAgo(400), activeSince: null }, now, limits)).toBeNull();
  });

  it("dedupes per claim per day, so a rerun the same day sends nothing new", () => {
    expect(staleDedupeKey("c1", now)).toBe("claim.stale:c1:2026-11-06");
    expect(staleDedupeKey("c1", new Date("2026-11-06T23:59:00.000Z"))).toBe(staleDedupeKey("c1", now));
    expect(staleDedupeKey("c1", new Date("2026-11-07T00:01:00.000Z"))).not.toBe(staleDedupeKey("c1", now));
  });
});

describe("C9 config", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("defaults to 7 / 30 days and ₹1,00,000", () => {
    delete process.env.CLAIM_STALE_PENDING_DAYS;
    delete process.env.CLAIM_STALE_ACTIVE_DAYS;
    delete process.env.CLAIM_HIGH_VALUE_RUPEES;
    expect(claimStaleLimits()).toEqual({ pendingDays: 7, activeDays: 30 });
    expect(claimHighValuePaise()).toBe(10_000_000n);
  });

  it("reads the limits from the environment, ignoring malformed values", () => {
    process.env.CLAIM_STALE_PENDING_DAYS = "3";
    process.env.CLAIM_STALE_ACTIVE_DAYS = "lots";
    process.env.CLAIM_HIGH_VALUE_RUPEES = "50000";
    expect(claimStaleLimits()).toEqual({ pendingDays: 3, activeDays: 30 });
    expect(claimHighValuePaise()).toBe(5_000_000n);
  });

  it("is high-value only strictly above the threshold", () => {
    expect(isHighValue(10_000_000n, 10_000_000n)).toBe(false);
    expect(isHighValue(10_000_001n, 10_000_000n)).toBe(true);
  });
});
