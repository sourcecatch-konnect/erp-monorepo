import { describe, expect, it } from "vitest";
import {
  addClaimRecoverySchema,
  createClaimSchema,
  pendingClaimSettlementSchema,
  settleClaimSchema,
} from "@skerp/validators";

const issuePaths = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  result.error?.issues.map((issue) => issue.path.join(".")) ?? [];

describe("createClaimSchema", () => {
  const base = {
    lrId: "lr1",
    claimDate: "2026-11-02",
    claimType: "DAMAGE",
    customerId: "c1",
    claimedAmount: "40000",
    items: [{ lrGoodsId: "g1", damagedQty: "5", shortageQty: "" }],
  };

  it("takes rupees and a form date, and gives paise and a Date", () => {
    const parsed = createClaimSchema.parse(base);
    expect(parsed.claimedAmount).toBe(4_000_000);
    expect(parsed.claimDate).toBeInstanceOf(Date);
    expect(parsed.items[0]).toEqual({ lrGoodsId: "g1", damagedQty: 5, shortageQty: 0 });
  });

  it("needs a damaged or short quantity on some goods line", () => {
    const result = createClaimSchema.safeParse({
      ...base,
      items: [{ lrGoodsId: "g1", damagedQty: "", shortageQty: "0" }],
    });
    expect(issuePaths(result)).toContain("items");
  });

  it("refuses negative quantities", () => {
    const result = createClaimSchema.safeParse({
      ...base,
      items: [{ lrGoodsId: "g1", damagedQty: "-1", shortageQty: "" }],
    });
    expect(issuePaths(result)).toContain("items.0.damagedQty");
  });
});

describe("settleClaimSchema — each method needs its own fields", () => {
  const base = { version: 3, settledAmount: "35000", settledAt: "2026-11-03" };

  it("a receipt deduction needs the receipt", () => {
    const result = settleClaimSchema.safeParse({ ...base, mode: "RECEIPT_DEDUCTION" });
    expect(issuePaths(result)).toEqual(["receiptAllocationId"]);
  });

  it("a credit note needs the note", () => {
    const result = settleClaimSchema.safeParse({ ...base, mode: "CREDIT_NOTE" });
    expect(issuePaths(result)).toEqual(["creditNoteId"]);
  });

  it("a separate payment needs how and from which account", () => {
    const result = settleClaimSchema.safeParse({ ...base, mode: "PAID_SEPARATELY" });
    expect(issuePaths(result).sort()).toEqual(["fundingLedgerId", "paymentMode"]);
    expect(
      settleClaimSchema.safeParse({
        ...base,
        mode: "PAID_SEPARATELY",
        paymentMode: "CASH",
        fundingLedgerId: "ledger1",
      }).success,
    ).toBe(true);
  });
});

describe("pendingClaimSettlementSchema", () => {
  it("reads back what was stored on the claim (date as ISO)", () => {
    const parsed = pendingClaimSettlementSchema.parse({
      settledAmountPaise: 3_500_000,
      settledAt: "2026-11-03T00:00:00.000Z",
      mode: "RECEIPT_DEDUCTION",
      receiptAllocationId: "alloc1",
    });
    expect(parsed.settledAt.toISOString()).toBe("2026-11-03T00:00:00.000Z");
    expect(parsed.settledAmountPaise).toBe(3_500_000);
  });

  it("treats anything else as no pending settlement", () => {
    expect(pendingClaimSettlementSchema.safeParse(null).success).toBe(false);
    expect(pendingClaimSettlementSchema.safeParse({ mode: "CREDIT_NOTE" }).success).toBe(false);
  });
});

describe("addClaimRecoverySchema — each source names its party", () => {
  const base = { version: 2, amount: "21000" };

  it("insurance, railway and others need a party name", () => {
    for (const source of ["INSURANCE", "RAILWAY", "OTHER"]) {
      const result = addClaimRecoverySchema.safeParse({ ...base, source });
      expect(issuePaths(result)).toEqual(["partyName"]);
    }
    const ok = addClaimRecoverySchema.parse({ ...base, source: "INSURANCE", partyName: "New India Assurance" });
    expect(ok.amount).toBe(2_100_000);
  });

  it("transporter, driver and labour need the master row", () => {
    expect(issuePaths(addClaimRecoverySchema.safeParse({ ...base, source: "TRANSPORTER" }))).toEqual(["transportId"]);
    expect(issuePaths(addClaimRecoverySchema.safeParse({ ...base, source: "DRIVER" }))).toEqual(["driverId"]);
    expect(issuePaths(addClaimRecoverySchema.safeParse({ ...base, source: "LABOUR" }))).toEqual(["labourId"]);
  });
});
