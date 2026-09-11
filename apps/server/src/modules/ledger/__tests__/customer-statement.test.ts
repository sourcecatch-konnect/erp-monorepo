import { describe, expect, it } from "vitest";

import {
  composeStatement,
  computeBillOutstanding,
  type BillLite,
  type CreditNoteLite,
  type SettlementLite,
  type StatementInputRow,
} from "../customer-statement.compute.js";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const meta = (onAccountPaise = 0) => ({
  customerId: "c1",
  customerName: "Acme",
  onAccountPaise,
});

const billRow = (id: string, date: string, paise: number): StatementInputRow => ({
  id,
  date: d(date),
  kind: "BILL",
  particulars: `Bill ${id}`,
  voucherNumber: id,
  voucherId: id,
  href: null,
  debitPaise: paise,
  creditPaise: 0,
  sortSeq: 0,
});

const receiptRow = (
  id: string,
  date: string,
  cashPaise: number,
  tdsPaise = 0,
): StatementInputRow => ({
  id,
  date: d(date),
  kind: "RECEIPT",
  particulars: `Receipt ${id}`,
  voucherNumber: id,
  voucherId: id,
  href: null,
  debitPaise: 0,
  creditPaise: cashPaise + tdsPaise,
  receiptCashPaise: cashPaise,
  receiptTdsPaise: tdsPaise,
  sortSeq: 1,
});

const cnRow = (id: string, date: string, paise: number): StatementInputRow => ({
  id,
  date: d(date),
  kind: "CREDIT_NOTE",
  particulars: `CN ${id}`,
  voucherNumber: id,
  voucherId: id,
  href: null,
  debitPaise: 0,
  creditPaise: paise,
  sortSeq: 2,
});

describe("composeStatement", () => {
  it("matches the epic's worked example (closing owes ₹25,000)", () => {
    const rows = [
      billRow("B0012", "2025-08-03", 40_000_00),
      billRow("B0018", "2025-08-10", 60_000_00),
      receiptRow("RCPT0003", "2025-08-20", 70_000_00),
      cnRow("CN0002", "2025-08-25", 5_000_00),
    ];

    const view = composeStatement(rows, {}, meta());

    expect(view.openingBalancePaise).toBe(0);
    expect(view.lines.map((l) => l.runningBalancePaise)).toEqual([
      40_000_00,
      1_00_000_00,
      30_000_00,
      25_000_00,
    ]);
    expect(view.closingBalancePaise).toBe(25_000_00);
    expect(view.totals.outstandingPaise).toBe(25_000_00);
    expect(view.totals.billedPaise).toBe(1_00_000_00);
    expect(view.totals.receivedPaise).toBe(70_000_00);
  });

  it("opening balance for a mid-history `from` == closing of the prior period", () => {
    const rows = [
      billRow("B1", "2025-08-05", 30_000_00),
      receiptRow("R1", "2025-08-20", 10_000_00),
      billRow("B2", "2025-09-04", 12_000_00),
    ];

    const augClose = composeStatement(rows, { to: d("2025-08-31") }, meta())
      .closingBalancePaise;
    const sepOpen = composeStatement(rows, { from: d("2025-09-01") }, meta())
      .openingBalancePaise;

    expect(augClose).toBe(20_000_00);
    expect(sepOpen).toBe(augClose);
  });

  it("drops rows dated after `to` entirely", () => {
    const rows = [
      billRow("B1", "2025-08-05", 30_000_00),
      billRow("B2", "2025-09-10", 99_000_00),
    ];
    const view = composeStatement(rows, { to: d("2025-08-31") }, meta());
    expect(view.lines).toHaveLength(1);
    expect(view.closingBalancePaise).toBe(30_000_00);
  });

  it("orders bill before receipt on the same date, TDS lands in totals", () => {
    const rows = [
      receiptRow("R1", "2025-08-10", 9_000_00, 1_000_00),
      billRow("B1", "2025-08-10", 10_000_00),
    ];
    const view = composeStatement(rows, {}, meta());
    expect(view.lines.map((l) => l.kind)).toEqual(["BILL", "RECEIPT"]);
    expect(view.closingBalancePaise).toBe(0); // 10k billed − (9k cash + 1k TDS)
    expect(view.totals.tdsPaise).toBe(1_000_00);
    expect(view.totals.receivedPaise).toBe(9_000_00);
  });

  it("on-account cash is reported but does not move the balance", () => {
    const rows = [billRow("B1", "2025-08-05", 10_000_00)];
    const view = composeStatement(rows, {}, meta(3_000_00));
    expect(view.closingBalancePaise).toBe(10_000_00);
    expect(view.totals.onAccountPaise).toBe(3_000_00);
  });
});

describe("computeBillOutstanding", () => {
  const asOf = d("2025-12-31");

  it("one paid, one half-paid, one unpaid bill", () => {
    const bills: BillLite[] = [
      { id: "B1", billNumber: "B1", billDate: d("2025-08-01"), dueDate: d("2025-08-31"), totalAmountPaise: 10_000_00 },
      { id: "B2", billNumber: "B2", billDate: d("2025-08-02"), dueDate: d("2025-09-01"), totalAmountPaise: 20_000_00 },
      { id: "B3", billNumber: "B3", billDate: d("2025-08-03"), dueDate: d("2025-09-02"), totalAmountPaise: 5_000_00 },
    ];
    const settlements: SettlementLite[] = [
      { billId: "B1", settledPaise: 10_000_00, at: d("2025-09-10") },
      { billId: "B2", settledPaise: 10_000_00, at: d("2025-09-11") },
    ];

    const rows = computeBillOutstanding(bills, settlements, [], asOf);
    const by = Object.fromEntries(rows.map((r) => [r.billId, r.outstandingPaise]));
    expect(by).toEqual({ B1: 0, B2: 10_000_00, B3: 5_000_00 });
  });

  it("credit note reduces the bill; settlement/CN after asOf is ignored", () => {
    const bills: BillLite[] = [
      { id: "B1", billNumber: "B1", billDate: d("2025-08-01"), dueDate: null, totalAmountPaise: 10_000_00 },
    ];
    const settlements: SettlementLite[] = [
      { billId: "B1", settledPaise: 3_000_00, at: d("2025-08-15") },
      { billId: "B1", settledPaise: 4_000_00, at: d("2026-02-01") }, // after asOf
    ];
    const creditNotes: CreditNoteLite[] = [
      { billId: "B1", amountPaise: 1_000_00, at: d("2025-09-01") },
    ];

    const row = computeBillOutstanding(bills, settlements, creditNotes, asOf)[0]!;
    expect(row.settledPaise).toBe(3_000_00);
    expect(row.creditNotePaise).toBe(1_000_00);
    expect(row.outstandingPaise).toBe(6_000_00);
  });

  it("never returns a negative outstanding (over-settlement floors at 0)", () => {
    const bills: BillLite[] = [
      { id: "B1", billNumber: "B1", billDate: d("2025-08-01"), dueDate: null, totalAmountPaise: 10_000_00 },
    ];
    const settlements: SettlementLite[] = [
      { billId: "B1", settledPaise: 12_000_00, at: d("2025-08-15") },
    ];
    const row = computeBillOutstanding(bills, settlements, [], asOf)[0]!;
    expect(row.outstandingPaise).toBe(0);
  });

  it("excludes a bill dated after asOf", () => {
    const bills: BillLite[] = [
      { id: "B1", billNumber: "B1", billDate: d("2026-06-01"), dueDate: null, totalAmountPaise: 9_000_00 },
    ];
    expect(computeBillOutstanding(bills, [], [], asOf)).toHaveLength(0);
  });

  it("FY boundary — a 31 Mar bill paid 2 Apr is fully outstanding at 31 Mar", () => {
    const bills: BillLite[] = [
      { id: "B1", billNumber: "B1", billDate: d("2026-03-31"), dueDate: d("2026-04-30"), totalAmountPaise: 50_000_00 },
    ];
    const settlements: SettlementLite[] = [
      { billId: "B1", settledPaise: 50_000_00, at: d("2026-04-02") },
    ];

    const atMar31 = computeBillOutstanding(bills, settlements, [], d("2026-03-31"));
    const atApr05 = computeBillOutstanding(bills, settlements, [], d("2026-04-05"));
    expect(atMar31[0]!.outstandingPaise).toBe(50_000_00);
    expect(atApr05[0]!.outstandingPaise).toBe(0);
  });
});
