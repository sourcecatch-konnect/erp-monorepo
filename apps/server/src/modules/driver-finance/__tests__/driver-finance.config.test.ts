import { afterEach, describe, expect, it } from "vitest";
import { driverFinanceStartDate } from "../driver-finance.config.js";

const ORIGINAL = process.env.DRIVER_FINANCE_START_DATE;
const iso = (d: Date) => d.toISOString().slice(0, 10);

describe("driverFinanceStartDate", () => {
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.DRIVER_FINANCE_START_DATE;
    else process.env.DRIVER_FINANCE_START_DATE = ORIGINAL;
  });

  it("defaults to the Phase 2 go-live date, 1 Oct 2026", () => {
    delete process.env.DRIVER_FINANCE_START_DATE;
    expect(iso(driverFinanceStartDate())).toBe("2026-10-01");
  });

  it("uses the configured date", () => {
    process.env.DRIVER_FINANCE_START_DATE = "2026-11-01";
    expect(iso(driverFinanceStartDate())).toBe("2026-11-01");
  });

  it("falls back to the default on a typo instead of opening up all history", () => {
    process.env.DRIVER_FINANCE_START_DATE = "01-11-2026";
    expect(iso(driverFinanceStartDate())).toBe("2026-10-01");
    process.env.DRIVER_FINANCE_START_DATE = "2026-13-45";
    expect(iso(driverFinanceStartDate())).toBe("2026-10-01");
  });
});
