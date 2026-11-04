import { afterEach, describe, expect, it } from "vitest";
import { claimSettlementApprovalLimitPaise } from "../claim.config.js";
import {
  RECOVERED_ELSEWHERE,
  claimItemsBlocker,
  recoveryBlocker,
  needsSettlementApproval,
  rupeesText,
  settleBlocker,
  settlementLinkBlocker,
} from "../claim.settle.compute.js";

const rs = (rupees: number) => BigInt(Math.round(rupees * 100));

const assessed = {
  status: "ACTIVE" as const,
  goodsValuePaise: rs(40_000),
  causedBy: "TRANSPORTER",
  claimedAmountPaise: rs(40_000),
};

describe("settleBlocker", () => {
  it("settles an assessed claim up to the claimed amount", () => {
    expect(settleBlocker(assessed, rs(35_000))).toBeNull();
    expect(settleBlocker(assessed, rs(40_000))).toBeNull();
  });

  it("refuses more than the claimed amount", () => {
    expect(settleBlocker(assessed, rs(40_000.01))).toMatch(/can't be more than the ₹40,000.00 claimed/);
  });

  it("refuses a claim that isn't assessed yet", () => {
    expect(settleBlocker({ ...assessed, status: "PENDING" }, rs(1))).toMatch(/assessed/);
    expect(settleBlocker({ ...assessed, status: "SETTLED" }, rs(1))).toMatch(/assessed/);
  });

  it("refuses without goods value or caused-by", () => {
    expect(settleBlocker({ ...assessed, goodsValuePaise: null }, rs(1))).toMatch(/goods value/);
    expect(settleBlocker({ ...assessed, causedBy: null }, rs(1))).toMatch(/caused it/);
  });

  it("refuses zero", () => {
    expect(settleBlocker(assessed, 0n)).toMatch(/more than zero/);
  });
});

describe("needsSettlementApproval", () => {
  it("needs a second user only above the limit", () => {
    expect(needsSettlementApproval(rs(25_000), rs(25_000))).toBe(false);
    expect(needsSettlementApproval(rs(25_000.01), rs(25_000))).toBe(true);
  });
});

describe("settlementLinkBlocker", () => {
  const link = {
    kind: "receipt deduction" as const,
    availablePaise: rs(35_000),
    amountPaise: rs(35_000),
    sameCustomer: true,
    linkedClaimNumber: null,
  };

  it("accepts a free deduction that covers the amount", () => {
    expect(settlementLinkBlocker(link)).toBeNull();
  });

  it("refuses a deduction already linked to another claim", () => {
    expect(settlementLinkBlocker({ ...link, linkedClaimNumber: "SKT/CLM/JAL/26-27/00002" })).toBe(
      "This receipt deduction already settles claim SKT/CLM/JAL/26-27/00002",
    );
  });

  it("refuses another customer's credit note", () => {
    expect(
      settlementLinkBlocker({ ...link, kind: "credit note", sameCustomer: false }),
    ).toMatch(/different customer/);
  });

  it("refuses a deduction smaller than the settlement", () => {
    expect(settlementLinkBlocker({ ...link, availablePaise: rs(20_000) })).toMatch(
      /only ₹20,000.00 — it doesn't cover ₹35,000.00/,
    );
  });
});

describe("claimItemsBlocker", () => {
  const goods = [
    { id: "g1", name: "Cartons", quantity: 100 },
    { id: "g2", name: "Drums", quantity: 10 },
  ];

  it("accepts quantities within what was booked", () => {
    expect(
      claimItemsBlocker([{ lrGoodsId: "g1", damagedQty: 5, shortageQty: 95 }], goods),
    ).toBeNull();
  });

  it("refuses more than was booked, other LRs' goods, and duplicates", () => {
    expect(
      claimItemsBlocker([{ lrGoodsId: "g2", damagedQty: 8, shortageQty: 3 }], goods),
    ).toMatch(/more than the 10 booked/);
    expect(
      claimItemsBlocker([{ lrGoodsId: "x", damagedQty: 1, shortageQty: 0 }], goods),
    ).toMatch(/belong to this LR/);
    expect(
      claimItemsBlocker(
        [
          { lrGoodsId: "g1", damagedQty: 1, shortageQty: 0 },
          { lrGoodsId: "g1", damagedQty: 1, shortageQty: 0 },
        ],
        goods,
      ),
    ).toMatch(/listed twice/);
  });
});

describe("claimSettlementApprovalLimitPaise", () => {
  const original = process.env.CLAIM_SETTLEMENT_APPROVAL_LIMIT_RUPEES;
  afterEach(() => {
    if (original === undefined) delete process.env.CLAIM_SETTLEMENT_APPROVAL_LIMIT_RUPEES;
    else process.env.CLAIM_SETTLEMENT_APPROVAL_LIMIT_RUPEES = original;
  });

  it("defaults to ₹25,000", () => {
    delete process.env.CLAIM_SETTLEMENT_APPROVAL_LIMIT_RUPEES;
    expect(claimSettlementApprovalLimitPaise()).toBe(rs(25_000));
  });

  it("reads rupees from the environment, 0 meaning every settlement", () => {
    process.env.CLAIM_SETTLEMENT_APPROVAL_LIMIT_RUPEES = "10000.50";
    expect(claimSettlementApprovalLimitPaise()).toBe(rs(10_000.5));
    process.env.CLAIM_SETTLEMENT_APPROVAL_LIMIT_RUPEES = "0";
    expect(claimSettlementApprovalLimitPaise()).toBe(0n);
  });

  it("falls back to the default on a malformed value, never to no limit", () => {
    process.env.CLAIM_SETTLEMENT_APPROVAL_LIMIT_RUPEES = "-5";
    expect(claimSettlementApprovalLimitPaise()).toBe(rs(25_000));
    process.env.CLAIM_SETTLEMENT_APPROVAL_LIMIT_RUPEES = "lots";
    expect(claimSettlementApprovalLimitPaise()).toBe(rs(25_000));
  });
});

describe("rupeesText", () => {
  it("formats paise in Indian grouping", () => {
    expect(rupeesText(rs(123_456.7))).toBe("₹1,23,456.70");
  });
});

describe("recoveryBlocker (C5)", () => {
  const settled = {
    status: "SETTLED" as const,
    settledAmountPaise: rs(35_000),
    claimedAmountPaise: rs(40_000),
  };

  it("takes a 60% insurance + 40% broker split of the settled amount", () => {
    expect(recoveryBlocker(settled, 0n, rs(21_000))).toBeNull();
    expect(recoveryBlocker(settled, rs(21_000), rs(14_000))).toBeNull();
  });

  it("refuses recoveries beyond the settled amount, saying what's left", () => {
    expect(recoveryBlocker(settled, rs(21_000), rs(14_000.01))).toBe(
      "Recoveries can't add up to more than the ₹35,000.00 settled — only ₹14,000.00 is left to recover",
    );
  });

  it("caps at the claimed amount until the claim is settled", () => {
    const active = { ...settled, status: "ACTIVE" as const, settledAmountPaise: null };
    expect(recoveryBlocker(active, 0n, rs(40_000))).toBeNull();
    expect(recoveryBlocker(active, 0n, rs(40_000.01))).toMatch(/₹40,000.00 claimed/);
  });

  it("only on an active or settled claim", () => {
    expect(recoveryBlocker({ ...settled, status: "PENDING" }, 0n, rs(1))).toMatch(/active or settled/);
    expect(recoveryBlocker({ ...settled, status: "REJECTED" }, 0n, rs(1))).toMatch(/active or settled/);
  });

  it("leaves transporter and driver recoveries to their payment runs", () => {
    expect(RECOVERED_ELSEWHERE.TRANSPORTER).toMatch(/vendor payment slip/);
    expect(RECOVERED_ELSEWHERE.DRIVER).toMatch(/salary run/);
    expect(RECOVERED_ELSEWHERE.INSURANCE).toBeUndefined();
  });
});

describe("settleBlocker with recoveries already filed (C5)", () => {
  it("won't settle below what's already being recovered", () => {
    expect(settleBlocker(assessed, rs(20_000), rs(25_000))).toMatch(
      /₹25,000.00 is already being recovered/,
    );
    expect(settleBlocker(assessed, rs(25_000), rs(25_000))).toBeNull();
  });
});
