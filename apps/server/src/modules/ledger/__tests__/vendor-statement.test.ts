import { describe, expect, it } from "vitest";

import {
  composeVendorStatement,
  type VendorStatementInputRow,
} from "../vendor-statement.compute.js";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const meta = () => ({
  partyId: "t1",
  partyType: "TRANSPORTER" as const,
  partyName: "Speedy Transport",
});

const accrualRow = (
  slipId: string,
  date: string,
  netPaise: number,
): VendorStatementInputRow => ({
  id: slipId,
  date: d(date),
  kind: "ACCRUAL",
  particulars: "Accrual",
  voucherNumber: slipId,
  slipId,
  debitPaise: 0,
  creditPaise: netPaise,
  sortSeq: 0,
});

const paymentRow = (
  id: string,
  slipId: string,
  date: string,
  paidPaise: number,
): VendorStatementInputRow => ({
  id,
  date: d(date),
  kind: "PAYMENT",
  particulars: "Payment",
  voucherNumber: slipId,
  slipId,
  debitPaise: paidPaise,
  creditPaise: 0,
  sortSeq: 1,
});

const reversalRow = (
  slipId: string,
  date: string,
  netPaise: number,
): VendorStatementInputRow => ({
  id: `${slipId}:reversal`,
  date: d(date),
  kind: "REVERSAL",
  particulars: "Reversal (slip cancelled)",
  voucherNumber: slipId,
  slipId,
  debitPaise: netPaise,
  creditPaise: 0,
  sortSeq: 2,
});

describe("composeVendorStatement", () => {
  it("an approved unpaid slip appears as an outstanding credit balance", () => {
    // Matches VP-3's transporter posting example: freight 50,000 + detention
    // 0, deductions 22,500 (advance 20,000 + commission 1,000 + hamali 500 +
    // TDS 1,000) -> net payable 27,500.
    const view = composeVendorStatement(
      [accrualRow("slip1", "2026-01-05", 27500)],
      {},
      meta(),
    );
    expect(view.closingBalancePaise).toBe(27500);
    expect(view.totals.accruedPaise).toBe(27500);
    expect(view.totals.paidPaise).toBe(0);
    expect(view.totals.outstandingPaise).toBe(27500);
  });

  it("a partial payment reduces the outstanding balance", () => {
    const view = composeVendorStatement(
      [
        accrualRow("slip1", "2026-01-05", 27500),
        paymentRow("pay1", "slip1", "2026-01-10", 15000),
      ],
      {},
      meta(),
    );
    expect(view.closingBalancePaise).toBe(12500);
    expect(view.totals.accruedPaise).toBe(27500);
    expect(view.totals.paidPaise).toBe(15000);
  });

  it("full settlement across two payments brings the slip reference to zero", () => {
    const view = composeVendorStatement(
      [
        accrualRow("slip1", "2026-01-05", 27500),
        paymentRow("pay1", "slip1", "2026-01-10", 15000),
        paymentRow("pay2", "slip1", "2026-01-20", 12500),
      ],
      {},
      meta(),
    );
    expect(view.closingBalancePaise).toBe(0);
    expect(view.totals.paidPaise).toBe(27500);
  });

  it("a cancelled-and-reversed slip nets to zero via an explicit accrual + reversal pair", () => {
    // Unlike the Debtor statement (which excludes a cancelled bill and its
    // reversal entirely), the vendor statement shows both rows explicitly —
    // the accrual AND the reversal stay visible for audit, they just net to
    // zero rather than one of them being silently omitted.
    const view = composeVendorStatement(
      [
        accrualRow("cancelledSlip", "2026-01-05", 10000),
        reversalRow("cancelledSlip", "2026-01-09", 10000),
        accrualRow("liveSlip", "2026-01-05", 5000),
      ],
      {},
      meta(),
    );
    expect(view.closingBalancePaise).toBe(5000);
    expect(view.totals.accruedPaise).toBe(15000);
    expect(view.totals.reversedPaise).toBe(10000);
    expect(view.lines.map((l) => l.kind)).toEqual(["ACCRUAL", "ACCRUAL", "REVERSAL"]);
  });

  it("multiple slips accumulate independently in the running balance", () => {
    const view = composeVendorStatement(
      [
        accrualRow("slip1", "2026-01-05", 27500),
        accrualRow("slip2", "2026-01-08", 9800),
        paymentRow("pay1", "slip1", "2026-01-10", 27500),
      ],
      {},
      meta(),
    );
    expect(view.closingBalancePaise).toBe(9800);
    expect(view.lines).toHaveLength(3);
  });

  it("opening balance carries rows before `from`, and drops them from `lines`", () => {
    const view = composeVendorStatement(
      [
        accrualRow("slip1", "2025-12-01", 5000),
        paymentRow("pay1", "slip1", "2025-12-15", 2000),
        accrualRow("slip2", "2026-01-05", 4000),
      ],
      { from: d("2026-01-01") },
      meta(),
    );
    expect(view.openingBalancePaise).toBe(3000);
    expect(view.lines).toHaveLength(1);
    expect(view.closingBalancePaise).toBe(7000);
  });
});
