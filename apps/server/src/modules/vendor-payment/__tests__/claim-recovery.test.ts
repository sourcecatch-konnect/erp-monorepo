import { describe, expect, it } from "vitest";
import { ackCoveredPaise } from "../calculators/claim-recovery.js";

const rs = (rupees: number) => BigInt(Math.round(rupees * 100));

const base = {
  origin: "LR_ACK",
  ackDamagePaise: rs(5_000),
  lrTransportId: "t1",
  recoveryTransportId: "t1",
  amountPaise: rs(15_000),
};

describe("ackCoveredPaise — the truck line already deducts the ack's damage (C7)", () => {
  it("QA scenario: ₹15,000 recovery with ₹5,000 ack damage deducts only ₹10,000 more", () => {
    const covered = ackCoveredPaise(base);
    expect(covered).toBe(rs(5_000));
    expect(base.amountPaise - covered).toBe(rs(10_000));
  });

  it("deducts nothing more when the ack damage covers the whole recovery", () => {
    expect(ackCoveredPaise({ ...base, amountPaise: rs(5_000) })).toBe(rs(5_000));
    expect(ackCoveredPaise({ ...base, amountPaise: rs(3_000) })).toBe(rs(3_000));
  });

  it("deducts the whole recovery for a GRN or manual claim", () => {
    expect(ackCoveredPaise({ ...base, origin: "GRN" })).toBe(0n);
    expect(ackCoveredPaise({ ...base, origin: "MANUAL" })).toBe(0n);
  });

  it("deducts the whole recovery when the truck was another transporter's or our own", () => {
    expect(ackCoveredPaise({ ...base, lrTransportId: "t2" })).toBe(0n);
    expect(ackCoveredPaise({ ...base, lrTransportId: null })).toBe(0n);
  });

  it("has nothing to cover without ack damage", () => {
    expect(ackCoveredPaise({ ...base, ackDamagePaise: 0n })).toBe(0n);
  });
});
