import { describe, expect, it } from "vitest";
import { buildJobCardPaymentLines } from "../job-card-payment.lines.js";

const args = {
  providerLedgerId: "provider",
  fundingLedgerId: "bank",
  cashPaise: 800n,
  tdsPaise: 100n,
  tdsLedgerId: "tds",
  narration: "Settlement",
};
describe("job card settlement entries", () => {
  it("settles provider payable with cash and TDS without another repair expense", () => {
    const lines = buildJobCardPaymentLines(args);
    expect(
      lines.map(({ ledgerId, debitPaise, creditPaise }) => ({
        ledgerId,
        debitPaise,
        creditPaise,
      })),
    ).toEqual([
      { ledgerId: "provider", debitPaise: 900n, creditPaise: 0n },
      { ledgerId: "bank", debitPaise: 0n, creditPaise: 800n },
      { ledgerId: "tds", debitPaise: 0n, creditPaise: 100n },
    ]);
    expect(
      lines.reduce((sum, line) => sum + line.debitPaise - line.creditPaise, 0n),
    ).toBe(0n);
  });
  it("omits TDS when nothing is withheld", () => {
    expect(
      buildJobCardPaymentLines({
        ...args,
        tdsPaise: 0n,
        tdsLedgerId: undefined,
      }),
    ).toHaveLength(2);
  });
  it("rejects unsupported amounts and a missing TDS ledger", () => {
    expect(() =>
      buildJobCardPaymentLines({ ...args, tdsPaise: -1n }),
    ).toThrow();
    expect(() =>
      buildJobCardPaymentLines({ ...args, cashPaise: 0n, tdsPaise: 0n }),
    ).toThrow();
    expect(() =>
      buildJobCardPaymentLines({ ...args, tdsLedgerId: undefined }),
    ).toThrow();
  });
  it("posts withholding-only settlement without any zero cash line", () => {
    const lines = buildJobCardPaymentLines({
      ...args,
      cashPaise: 0n,
      tdsPaise: 100n,
    });
    expect(lines.map((line) => line.ledgerId)).toEqual(["provider", "tds"]);
    expect(
      lines.reduce((sum, line) => sum + line.debitPaise - line.creditPaise, 0n),
    ).toBe(0n);
    expect(
      lines.every((line) => line.debitPaise > 0n || line.creditPaise > 0n),
    ).toBe(true);
  });
});
