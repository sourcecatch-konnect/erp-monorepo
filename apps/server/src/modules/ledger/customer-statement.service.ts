import { db } from "../../../prisma/prisma.js";
import { NotFoundError } from "../../lib/error.js";
import type { BillOutstandingRow, CustomerStatementView } from "@skerp/types";

import {
  RECEIVABLE_BILL_STATUSES,
  composeStatement,
  computeBillOutstanding,
  num as n,
  type BillLite,
  type CreditNoteLite,
  type SettlementLite,
  type StatementInputRow,
} from "./customer-statement.compute.js";

/**
 * Customer Statement (ACCT-R2) + bill-wise outstanding (ACCT-R4) — DB layer.
 *
 * Reads **directly** from `Bill` / `Receipt` / `ReceiptAllocation`, plus
 * `JournalEntry` / `JournalLine` for CREDIT_NOTE / DEBIT_NOTE / manual JOURNAL
 * vouchers that hit the customer's party ledger. It deliberately does NOT read
 * `LedgerEntry` (the cash-movement mirror the old Debtor tab used — bills-blind)
 * and does NOT try to reconstruct the whole ledger from `JournalLine`
 * (ACCT-R9, a separate future migration).
 *
 * SALES and RECEIPT vouchers also touch the party ledger, so the journal-line
 * read is filtered to CREDIT_NOTE / DEBIT_NOTE / JOURNAL to avoid double
 * counting the bills/receipts already read from their own tables.
 *
 * Pure composition math lives in ./customer-statement.compute.ts (unit-tested).
 */

export { RECEIVABLE_BILL_STATUSES };
export type { BillLite, CreditNoteLite, SettlementLite } from "./customer-statement.compute.js";

const ADJUSTMENT_VOUCHER_TYPES = ["CREDIT_NOTE", "DEBIT_NOTE", "JOURNAL"] as const;

export type StatementFilters = {
  /** Extra Prisma `where` fragment on `branchId` — either `{ branchId }` (a
   *  chosen branch) or the caller's `branchFilter(req)` scope. */
  branchWhere?: Record<string, unknown>;
  fyCode?: string;
  from?: string;
  to?: string;
};

export type BillOutstandingFilters = {
  branchWhere?: Record<string, unknown>;
  fyCode?: string;
  /** Defaults to now. */
  asOf?: Date;
};

const dayStart = (d: string): Date => new Date(`${d}T00:00:00.000Z`);
const dayEnd = (d: string): Date => new Date(`${d}T23:59:59.999Z`);

async function customerNameOrThrow(customerId: string): Promise<string> {
  const row = await db.customer.findUnique({
    where: { id: customerId },
    select: { name: true },
  });
  if (!row) throw new NotFoundError("Customer not found");
  return row.name;
}

/** ACCT-R2 — full statement for one customer. */
export async function buildCustomerStatement(
  customerId: string,
  filters: StatementFilters = {},
): Promise<CustomerStatementView> {
  const { branchWhere = {}, fyCode } = filters;
  const from = filters.from ? dayStart(filters.from) : null;
  const to = filters.to ? dayEnd(filters.to) : null;
  const fyWhere = fyCode ? { fyCode } : {};

  const customerName = await customerNameOrThrow(customerId);

  const [bills, receipts, partyLedger] = await Promise.all([
    db.bill.findMany({
      where: {
        billingCustomerId: customerId,
        status: { in: [...RECEIVABLE_BILL_STATUSES] },
        ...branchWhere,
        ...fyWhere,
      },
      select: {
        id: true,
        billNumber: true,
        billDate: true,
        totalAmountPaise: true,
        createdAt: true,
      },
      orderBy: [{ billDate: "asc" }, { createdAt: "asc" }],
    }),
    db.receipt.findMany({
      where: {
        customerId,
        status: "POSTED",
        ...branchWhere,
        ...fyWhere,
      },
      select: {
        id: true,
        receiptNumber: true,
        receivedAt: true,
        amountPaise: true,
        unallocatedPaise: true,
        paymentMode: true,
        createdAt: true,
        allocations: {
          select: {
            amountAppliedPaise: true,
            tdsAmountPaise: true,
            damageAmountPaise: true,
            rateDiffAmountPaise: true,
          },
        },
      },
      orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }],
    }),
    db.ledger.findUnique({
      where: { customerId },
      select: { id: true },
    }),
  ]);

  const adjustmentLines = partyLedger
    ? await db.journalLine.findMany({
        where: {
          ledgerId: partyLedger.id,
          journalEntry: {
            status: "POSTED",
            voucherType: { in: [...ADJUSTMENT_VOUCHER_TYPES] },
            // reverseJournal() (posting.service.ts) always reverses a
            // cancelled bill/receipt's voucher as a fresh voucherType:
            // "JOURNAL" entry with reversesId set to the original. That's
            // the double-entry ledger's own cleanup for something we ALREADY
            // exclude here via the Bill/Receipt `status` filter above —
            // without this guard it re-adds the cancelled amount as if it
            // were an independent adjustment (found via a real-data spot
            // check: a cancelled receipt's reversal inflated the statement
            // by exactly its amount vs. the R4/Ageing/CashReceivable figures).
            reversesId: null,
            ...branchWhere,
            ...fyWhere,
          },
        },
        select: {
          id: true,
          debitPaise: true,
          creditPaise: true,
          journalEntry: {
            select: {
              id: true,
              voucherType: true,
              voucherNumber: true,
              voucherDate: true,
              narration: true,
            },
          },
        },
      })
    : [];

  const rows: StatementInputRow[] = [];

  for (const b of bills) {
    rows.push({
      id: b.id,
      date: b.billDate,
      kind: "BILL",
      // Keep this short — the bill number already has its own column
      // (`voucherNumber` below); repeating it here just duplicates it.
      particulars: "Bill",
      voucherNumber: b.billNumber,
      voucherId: b.id,
      href: `/accounts/bills/${b.id}`,
      debitPaise: n(b.totalAmountPaise),
      creditPaise: 0,
      sortSeq: 0,
    });
  }

  for (const r of receipts) {
    const cash = r.allocations.reduce((s, a) => s + n(a.amountAppliedPaise), 0);
    const tds = r.allocations.reduce((s, a) => s + n(a.tdsAmountPaise), 0);
    const damage = r.allocations.reduce((s, a) => s + n(a.damageAmountPaise), 0);
    const rateDiff = r.allocations.reduce((s, a) => s + n(a.rateDiffAmountPaise), 0);
    // Full reduction of what the customer owes = cash applied + the deductions
    // they claimed (TDS / damage / rate difference). On-account (unapplied)
    // cash is reported separately and does NOT move the balance.
    const creditPaise = cash + tds + damage + rateDiff;
    rows.push({
      id: r.id,
      date: r.receivedAt,
      kind: "RECEIPT",
      particulars: `Receipt · ${r.paymentMode}`,
      voucherNumber: r.receiptNumber,
      voucherId: r.id,
      href: `/accounts/receipts/${r.id}`,
      debitPaise: 0,
      creditPaise,
      receiptCashPaise: cash,
      receiptTdsPaise: tds,
      sortSeq: 1,
    });
  }

  const ADJUSTMENT_KIND_LABEL: Record<"CREDIT_NOTE" | "DEBIT_NOTE" | "JOURNAL", string> = {
    CREDIT_NOTE: "Credit Note",
    DEBIT_NOTE: "Debit Note",
    JOURNAL: "Journal",
  };

  for (const l of adjustmentLines) {
    const je = l.journalEntry;
    const kind: "CREDIT_NOTE" | "DEBIT_NOTE" | "JOURNAL" =
      je.voucherType === "CREDIT_NOTE"
        ? "CREDIT_NOTE"
        : je.voucherType === "DEBIT_NOTE"
          ? "DEBIT_NOTE"
          : "JOURNAL";
    rows.push({
      id: je.id,
      date: je.voucherDate,
      kind,
      // Prefer the narration a human wrote; fall back to a plain type label
      // (not the voucher number again — that already has its own column).
      particulars: je.narration?.trim() || ADJUSTMENT_KIND_LABEL[kind],
      voucherNumber: je.voucherNumber,
      voucherId: je.id,
      href: null,
      debitPaise: n(l.debitPaise),
      creditPaise: n(l.creditPaise),
      sortSeq: 2,
    });
  }

  const onAccountPaise = receipts
    .filter((r) => !to || r.receivedAt <= to)
    .reduce((s, r) => s + n(r.unallocatedPaise), 0);

  return composeStatement(
    rows,
    { from, to },
    { customerId, customerName, onAccountPaise },
  );
}

/** ACCT-R4 — bill-wise outstanding for one customer. */
export async function perBillOutstanding(
  customerId: string,
  filters: BillOutstandingFilters = {},
): Promise<BillOutstandingRow[]> {
  const { branchWhere = {}, fyCode } = filters;
  const asOf = filters.asOf ?? new Date();
  const fyWhere = fyCode ? { fyCode } : {};

  const bills = await db.bill.findMany({
    where: {
      billingCustomerId: customerId,
      status: { in: [...RECEIVABLE_BILL_STATUSES] },
      ...branchWhere,
      ...fyWhere,
    },
    select: {
      id: true,
      billNumber: true,
      billDate: true,
      dueDate: true,
      totalAmountPaise: true,
    },
    orderBy: [{ billDate: "asc" }, { createdAt: "asc" }],
  });
  if (bills.length === 0) return [];

  const billIds = bills.map((b) => b.id);

  const [allocations, creditNotes] = await Promise.all([
    db.receiptAllocation.findMany({
      where: { billId: { in: billIds }, receipt: { status: "POSTED" } },
      select: {
        billId: true,
        amountAppliedPaise: true,
        tdsAmountPaise: true,
        damageAmountPaise: true,
        rateDiffAmountPaise: true,
        receipt: { select: { receivedAt: true } },
      },
    }),
    db.ledgerAllocation.findMany({
      where: {
        billId: { in: billIds },
        refType: "AGAINST_REF",
        journalEntry: { status: "POSTED", voucherType: "CREDIT_NOTE" },
      },
      select: {
        billId: true,
        amountPaise: true,
        journalEntry: { select: { voucherDate: true } },
      },
    }),
  ]);

  const settlements: SettlementLite[] = allocations.map((a) => ({
    billId: a.billId,
    settledPaise:
      n(a.amountAppliedPaise) +
      n(a.tdsAmountPaise) +
      n(a.damageAmountPaise) +
      n(a.rateDiffAmountPaise),
    at: a.receipt.receivedAt,
  }));

  const cnLites: CreditNoteLite[] = creditNotes.map((c) => ({
    billId: c.billId,
    amountPaise: n(c.amountPaise),
    at: c.journalEntry.voucherDate,
  }));

  const billLites: BillLite[] = bills.map((b) => ({
    id: b.id,
    billNumber: b.billNumber,
    billDate: b.billDate,
    dueDate: b.dueDate,
    totalAmountPaise: n(b.totalAmountPaise),
  }));

  return computeBillOutstanding(billLites, settlements, cnLites, asOf);
}
