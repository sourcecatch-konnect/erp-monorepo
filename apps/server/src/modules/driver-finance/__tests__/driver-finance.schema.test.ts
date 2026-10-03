import { describe, expect, it } from "vitest";
import {
  createDriverPayoutSchema,
  createDriverSalaryAdvanceSchema,
  reverseDriverFinanceEntrySchema,
} from "@skerp/validators";

const base = {
  driverId: "drv-1",
  amountPaise: "89500",
  paidAt: "2026-08-20",
  mode: "CASH",
  fundingLedgerId: "cash-ho",
  clientRequestId: "req-1",
};

describe("createDriverPayoutSchema", () => {
  it("accepts a log slip cash payment (Jasim's ₹895) without a branch", () => {
    const parsed = createDriverPayoutSchema.safeParse({
      ...base,
      source: "LOG_SLIP",
      logSlipId: "slip-1",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.amountPaise).toBe(89_500n);
  });

  it("requires the log slip for a LOG_SLIP payment", () => {
    const parsed = createDriverPayoutSchema.safeParse({ ...base, source: "LOG_SLIP" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.flatten().fieldErrors.logSlipId).toBeDefined();
  });

  it("requires a branch and no log slip for a MANUAL payment", () => {
    const noBranch = createDriverPayoutSchema.safeParse({ ...base, source: "MANUAL" });
    expect(noBranch.success).toBe(false);
    if (!noBranch.success) expect(noBranch.error.flatten().fieldErrors.branchId).toBeDefined();

    const withSlip = createDriverPayoutSchema.safeParse({
      ...base,
      source: "MANUAL",
      branchId: "br-1",
      logSlipId: "slip-1",
    });
    expect(withSlip.success).toBe(false);

    const ok = createDriverPayoutSchema.safeParse({ ...base, source: "MANUAL", branchId: "br-1" });
    expect(ok.success).toBe(true);
  });

  it("never accepts SALARY_RUN — those come from the salary run screen", () => {
    const parsed = createDriverPayoutSchema.safeParse({
      ...base,
      source: "SALARY_RUN",
      branchId: "br-1",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a zero amount", () => {
    const parsed = createDriverPayoutSchema.safeParse({
      ...base,
      amountPaise: "0",
      source: "MANUAL",
      branchId: "br-1",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("createDriverSalaryAdvanceSchema", () => {
  it("accepts Sunil's ₹8,000 advance and drops an empty reason", () => {
    const parsed = createDriverSalaryAdvanceSchema.safeParse({
      ...base,
      amountPaise: "800000",
      branchId: "br-1",
      reason: "   ",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.amountPaise).toBe(800_000n);
      expect(parsed.data.reason).toBeUndefined();
    }
  });

  it("requires a branch", () => {
    expect(createDriverSalaryAdvanceSchema.safeParse(base).success).toBe(false);
  });
});

describe("reverseDriverFinanceEntrySchema", () => {
  it("needs a reason of at least 3 characters", () => {
    expect(reverseDriverFinanceEntrySchema.safeParse({ reason: "ab" }).success).toBe(false);
    expect(reverseDriverFinanceEntrySchema.safeParse({ reason: "wrong driver" }).success).toBe(true);
  });
});
