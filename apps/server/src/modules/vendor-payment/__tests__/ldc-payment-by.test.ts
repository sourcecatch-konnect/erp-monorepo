import { describe, expect, it } from "vitest";

import type { DeliveryChallanPaymentBy } from "../../../../generated/prisma/index.js";
import { reviewReasonFor } from "../calculators/payment-by.js";

/**
 * L1 / Q1 — only a company-borne challan is an LDC broker payable.
 *
 * The rule itself is an allowlist in `ldc-broker.ts`; what is tested here is
 * the property that makes it safe: **every value other than COMPANY, present
 * and future, must land in the review queue with something an operator can
 * read.** A new enum value added later must not quietly become payable, and
 * must not produce an empty reason either.
 */

const ALL_VALUES: (DeliveryChallanPaymentBy | null)[] = [
  "COMPANY",
  "CLIENT",
  "TRANSPORTER",
  "CASH",
  null,
];

describe("LDC paymentBy — review reasons", () => {
  it("gives every non-payable value a non-empty, human reason", () => {
    for (const value of ALL_VALUES.filter((v) => v !== "COMPANY")) {
      const reason = reviewReasonFor(value);
      expect(reason.length).toBeGreaterThan(0);
      expect(reason).not.toMatch(/undefined|null"/);
    }
  });

  it("explains an unrecorded payment-by as something to go and set", () => {
    expect(reviewReasonFor(null)).toMatch(/never recorded/i);
  });

  it("does not claim a CASH challan was already paid — it asks", () => {
    // Q20: CASH is ambiguous (already settled vs owed, to be paid in cash).
    // The copy must prompt a check, never assert either reading.
    const reason = reviewReasonFor("CASH");
    expect(reason).toMatch(/confirm/i);
  });

  it("names the client as the settling party for CLIENT", () => {
    expect(reviewReasonFor("CLIENT")).toMatch(/client|customer/i);
  });

  it("falls back safely for a value added to the enum later", () => {
    // Cast deliberately: this is the future-enum case the allowlist protects.
    const future = "SOME_NEW_VALUE" as DeliveryChallanPaymentBy;
    const reason = reviewReasonFor(future);
    expect(reason).toContain("SOME_NEW_VALUE");
    expect(reason).toMatch(/not a company payable/i);
  });
});
