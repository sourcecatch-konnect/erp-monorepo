import { describe, expect, it } from "vitest";
import { claimMoneyTotals } from "../claim.compute.js";

const rs = (rupees: number) => BigInt(Math.round(rupees * 100));

describe("claimMoneyTotals", () => {
  it("has no net loss until the claim is settled", () => {
    expect(
      claimMoneyTotals({
        settledAmountPaise: null,
        recoveries: [{ status: "APPROVED", amountPaise: rs(20_000) }],
      }),
    ).toEqual({ recoveredAmountPaise: rs(20_000), netLossPaise: null });
  });

  it("subtracts approved and received recoveries from the settled amount", () => {
    // QA scenario: settled ₹35,000, insurance ₹20,000 received, transporter ₹15,000 approved.
    expect(
      claimMoneyTotals({
        settledAmountPaise: rs(35_000),
        recoveries: [
          { status: "RECEIVED", amountPaise: rs(20_000) },
          { status: "APPROVED", amountPaise: rs(15_000) },
        ],
      }),
    ).toEqual({ recoveredAmountPaise: rs(35_000), netLossPaise: 0n });
  });

  it("ignores filed and rejected recoveries", () => {
    expect(
      claimMoneyTotals({
        settledAmountPaise: rs(35_000),
        recoveries: [
          { status: "FILED", amountPaise: rs(20_000) },
          { status: "REJECTED", amountPaise: rs(10_000) },
          { status: "RECEIVED", amountPaise: rs(5_000) },
        ],
      }),
    ).toEqual({ recoveredAmountPaise: rs(5_000), netLossPaise: rs(30_000) });
  });

  it("is a full loss when nothing has been recovered", () => {
    expect(claimMoneyTotals({ settledAmountPaise: rs(1_234.5), recoveries: [] })).toEqual({
      recoveredAmountPaise: 0n,
      netLossPaise: rs(1_234.5),
    });
  });
});
