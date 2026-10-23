import { describe, expect, it } from "vitest";

import {
  RECEIVABLE_BILL_STATUSES,
  composeStatement,
  computeBillOutstanding,
  type BillLite,
  type CreditNoteLite,
  type SettlementLite,
  type StatementInputRow,
} from "../customer-statement.compute.js";
import { bucketBills, type AgeingBillLite } from "../ageing.compute.js";

/**
 * ACCT-R7 — the reconciliation identities that must hold or the accounts
 * team gets numbers that are "almost right":
 *
 *   Σ statement closing (per customer)
 *     == Σ bill-wise outstanding (R4)
 *     == Σ ageing buckets (R5)
 *     == the expected receivables figure
 *
 * plus: a cancelled bill / reversed receipt contributes nothing anywhere,
 * and the opening balance is correct across a financial-year boundary.
 */

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

type Fixture = {
  customerId: string;
  customerName: string;
  bills: BillLite[];
  settlements: SettlementLite[];
  creditNotes: CreditNoteLite[];
};

/** Turn the same primitives the DB layer reads into statement rows, exactly
 *  as customer-statement.service.ts maps them. */
function toStatementRows(fx: Fixture): StatementInputRow[] {
  const rows: StatementInputRow[] = fx.bills.map((b) => ({
    id: b.id,
    date: b.billDate,
    kind: "BILL",
    particulars: `Bill ${b.id}`,
    voucherNumber: b.billNumber,
    voucherId: b.id,
    href: null,
    debitPaise: b.totalAmountPaise,
    creditPaise: 0,
    sortSeq: 0,
  }));
  fx.settlements.forEach((s, i) =>
    rows.push({
      id: `stl-${fx.customerId}-${i}`,
      date: s.at,
      kind: "RECEIPT",
      particulars: "Receipt",
      voucherNumber: null,
      voucherId: null,
      href: null,
      debitPaise: 0,
      creditPaise: s.settledPaise,
      receiptCashPaise: s.settledPaise,
      receiptTdsPaise: 0,
      sortSeq: 1,
    }),
  );
  fx.creditNotes.forEach((c, i) =>
    rows.push({
      id: `cn-${fx.customerId}-${i}`,
      date: c.at,
      kind: "CREDIT_NOTE",
      particulars: "Credit note",
      voucherNumber: null,
      voucherId: null,
      href: null,
      debitPaise: 0,
      creditPaise: c.amountPaise,
      sortSeq: 2,
    }),
  );
  return rows;
}

const ACME: Fixture = {
  customerId: "acme",
  customerName: "Acme",
  bills: [
    { id: "A1", billNumber: "A1", billDate: d("2025-08-01"), dueDate: d("2025-08-31"), totalAmountPaise: 40_000_00 },
    { id: "A2", billNumber: "A2", billDate: d("2025-08-10"), dueDate: d("2025-09-10"), totalAmountPaise: 60_000_00 },
  ],
  settlements: [{ billId: "A1", settledPaise: 40_000_00, at: d("2025-08-20") }],
  creditNotes: [{ billId: "A2", amountPaise: 5_000_00, at: d("2025-08-25") }],
};

const GLOBEX: Fixture = {
  customerId: "globex",
  customerName: "Globex",
  bills: [
    { id: "G1", billNumber: "G1", billDate: d("2025-06-01"), dueDate: d("2025-06-30"), totalAmountPaise: 30_000_00 },
  ],
  settlements: [{ billId: "G1", settledPaise: 10_000_00, at: d("2025-07-01") }],
  creditNotes: [],
};

const asOf = d("2025-10-01");

describe("cross-report reconciliation", () => {
  const fixtures = [ACME, GLOBEX];

  it("Σ statement closing == Σ bill-wise outstanding == Σ ageing == receivables", () => {
    // R2 — per-customer statement closing
    const closingByCustomer = fixtures.map((fx) => {
      const view = composeStatement(
        toStatementRows(fx),
        { to: asOf },
        { customerId: fx.customerId, customerName: fx.customerName, onAccountPaise: 0 },
      );
      return view.closingBalancePaise;
    });
    const sumClosing = closingByCustomer.reduce((a, b) => a + b, 0);

    // R4 — per-bill outstanding
    const outstandingRows = fixtures.flatMap((fx) =>
      computeBillOutstanding(fx.bills, fx.settlements, fx.creditNotes, asOf).map(
        (r) => ({ ...r, customerId: fx.customerId }),
      ),
    );
    const sumOutstanding = outstandingRows.reduce((a, r) => a + r.outstandingPaise, 0);

    // R5 — ageing
    const ageingBills: AgeingBillLite[] = outstandingRows.map((r) => ({
      customerId: r.customerId,
      billDate: new Date(r.billDate),
      dueDate: r.dueDate ? new Date(r.dueDate) : null,
      outstandingPaise: r.outstandingPaise,
    }));
    const { totals } = bucketBills(ageingBills, asOf, new Map());

    const EXPECTED_RECEIVABLES =
      55_000_00 /* Acme: 100k billed − 40k settled − 5k CN */ +
      20_000_00; /* Globex: 30k billed − 10k settled */

    expect(sumClosing).toBe(EXPECTED_RECEIVABLES);
    expect(sumOutstanding).toBe(EXPECTED_RECEIVABLES);
    expect(totals.totalPaise).toBe(EXPECTED_RECEIVABLES);

    // and per-customer the three views agree too
    for (const fx of fixtures) {
      const stmt = composeStatement(
        toStatementRows(fx),
        { to: asOf },
        { customerId: fx.customerId, customerName: fx.customerName, onAccountPaise: 0 },
      ).closingBalancePaise;
      const bills = computeBillOutstanding(fx.bills, fx.settlements, fx.creditNotes, asOf);
      const sumBills = bills.reduce((a, r) => a + r.outstandingPaise, 0);
      expect(stmt).toBe(sumBills);
    }
  });

  it("a reversed receipt (settle then un-settle) nets to zero everywhere", () => {
    const reversed: Fixture = {
      customerId: "rev",
      customerName: "Reversed Co",
      bills: [
        { id: "R1", billNumber: "R1", billDate: d("2025-08-01"), dueDate: d("2025-08-31"), totalAmountPaise: 15_000_00 },
      ],
      settlements: [
        { billId: "R1", settledPaise: 15_000_00, at: d("2025-08-10") },
        { billId: "R1", settledPaise: -15_000_00, at: d("2025-08-12") }, // cancellation reversal
      ],
      creditNotes: [],
    };

    const stmt = composeStatement(
      toStatementRows(reversed),
      { to: asOf },
      { customerId: "rev", customerName: "Reversed Co", onAccountPaise: 0 },
    );
    const bills = computeBillOutstanding(reversed.bills, reversed.settlements, [], asOf);

    expect(stmt.closingBalancePaise).toBe(15_000_00); // back to fully outstanding
    expect(bills[0]!.outstandingPaise).toBe(15_000_00);
  });

  it("RECEIVABLE_BILL_STATUSES never includes CANCELLED or a pre-finalised status", () => {
    // This constant is what the DB layer's `where: { status: { in: [...] } }`
    // uses to exclude cancelled/not-yet-real bills before they ever reach
    // these compute functions (customer-statement.service.ts / ageing.service.ts).
    // A regression here (e.g. someone adding "CANCELLED" back in) would let a
    // dead bill re-enter every balance — this test is the guard for that,
    // since the actual Prisma filtering itself needs a DB to exercise.
    expect(RECEIVABLE_BILL_STATUSES).not.toContain("CANCELLED");
    expect(RECEIVABLE_BILL_STATUSES).not.toContain("DRAFT");
    expect(RECEIVABLE_BILL_STATUSES).not.toContain("PENDING_REVIEW");
    expect(RECEIVABLE_BILL_STATUSES).not.toContain("APPROVED");
    expect(RECEIVABLE_BILL_STATUSES).toEqual(
      expect.arrayContaining(["FINALISED", "SENT", "PARTIALLY_PAID", "PAID"]),
    );
  });

  it("a bill excluded upstream (simulating the DB status filter) affects no total", () => {
    const mixedStatusBills = [
      { ...ACME.bills[0]!, status: "CANCELLED" as const },
      { ...ACME.bills[1]!, status: "FINALISED" as const },
    ];
    // What buildCustomerStatement / perBillOutstanding actually do: filter by
    // RECEIVABLE_BILL_STATUSES before calling into the compute layer.
    const live = mixedStatusBills.filter((b) =>
      (RECEIVABLE_BILL_STATUSES as readonly string[]).includes(b.status),
    );
    expect(live).toHaveLength(1);
    expect(live[0]!.id).toBe(ACME.bills[1]!.id);

    const outstanding = computeBillOutstanding(live, ACME.settlements, ACME.creditNotes, asOf);
    expect(outstanding.some((r) => r.billId === ACME.bills[0]!.id)).toBe(false);
  });

  it("FY boundary — opening on 1 Apr equals closing on 31 Mar", () => {
    const spanningFy: Fixture = {
      customerId: "fy",
      customerName: "FY Co",
      bills: [
        { id: "F1", billNumber: "F1", billDate: d("2026-03-20"), dueDate: d("2026-04-20"), totalAmountPaise: 50_000_00 },
        { id: "F2", billNumber: "F2", billDate: d("2026-04-05"), dueDate: d("2026-05-05"), totalAmountPaise: 8_000_00 },
      ],
      settlements: [{ billId: "F1", settledPaise: 20_000_00, at: d("2026-03-28") }],
      creditNotes: [],
    };

    const rows = toStatementRows(spanningFy);
    const mk = (range: { from?: Date; to?: Date }) =>
      composeStatement(rows, range, {
        customerId: "fy",
        customerName: "FY Co",
        onAccountPaise: 0,
      });

    const marClose = mk({ to: d("2026-03-31") }).closingBalancePaise;
    const aprOpen = mk({ from: d("2026-04-01") }).openingBalancePaise;

    expect(marClose).toBe(30_000_00); // 50k − 20k, F2 not yet raised
    expect(aprOpen).toBe(marClose);
  });
});
