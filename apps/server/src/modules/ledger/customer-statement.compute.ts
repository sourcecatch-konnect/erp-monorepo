import type {
  BillOutstandingRow,
  CustomerStatementView,
  StatementLine,
  StatementLineKind,
} from "@skerp/types";

/**
 * Pure composition core for the Customer Statement (ACCT-R2) and bill-wise
 * outstanding (ACCT-R4). No Prisma, no I/O — everything here takes plain
 * fixture arrays so it can be unit-tested directly (ACCT-R7).
 *
 * All money is paise. Balance is Dr-positive: a bill raises it, a receipt /
 * credit note lowers it.
 */

/** Bill statuses that represent a real, live receivable (billNumber assigned,
 *  outstanding tracked). Anything earlier is not yet a debt; CANCELLED is dead. */
export const RECEIVABLE_BILL_STATUSES = [
  "FINALISED",
  "SENT",
  "PARTIALLY_PAID",
  "PAID",
] as const;

export const num = (v: bigint | number): number => Number(v);
const iso = (d: Date): string => d.toISOString();

export type StatementInputRow = {
  id: string;
  date: Date;
  kind: StatementLineKind;
  particulars: string;
  voucherNumber: string | null;
  voucherId: string | null;
  href: string | null;
  debitPaise: number;
  creditPaise: number;
  /** RECEIPT rows only — split of the credit, for the totals block. */
  receiptCashPaise?: number;
  receiptTdsPaise?: number;
  /** Stable tiebreak for rows sharing a `date` (kind order: bill before receipt). */
  sortSeq?: number;
};

export type StatementRange = { from?: Date | null; to?: Date | null };

export type StatementMeta = {
  customerId: string;
  customerName: string;
  /** Σ receipt cash received but not yet applied to a bill, as of `to`. Reported
   *  only — never moves the running balance (keeps closing == Σ bill outstanding). */
  onAccountPaise: number;
};

/**
 * Walk `rows` in date order, accumulating a Dr-positive running balance over
 * the FULL history, then keep only rows in `[from, to]`. Everything strictly
 * before `from` collapses into `openingBalancePaise`; anything after `to` is
 * dropped entirely (the statement is "as of `to`").
 */
export function composeStatement(
  rows: StatementInputRow[],
  range: StatementRange,
  meta: StatementMeta,
): CustomerStatementView {
  const from = range.from ?? null;
  const to = range.to ?? null;

  const ordered = rows
    .filter((r) => !to || r.date <= to)
    .sort(
      (a, b) =>
        a.date.getTime() - b.date.getTime() ||
        (a.sortSeq ?? 0) - (b.sortSeq ?? 0) ||
        a.id.localeCompare(b.id),
    );

  let running = 0;
  let openingBalancePaise = 0;
  const lines: StatementLine[] = [];
  const totals = {
    billedPaise: 0,
    receivedPaise: 0,
    tdsPaise: 0,
    adjustmentsPaise: 0,
    onAccountPaise: meta.onAccountPaise,
    outstandingPaise: 0,
  };

  for (const r of ordered) {
    running += r.debitPaise - r.creditPaise;

    if (from && r.date < from) {
      openingBalancePaise = running;
      continue;
    }

    lines.push({
      id: r.id,
      date: iso(r.date),
      kind: r.kind,
      particulars: r.particulars,
      voucherNumber: r.voucherNumber,
      voucherId: r.voucherId,
      href: r.href,
      debitPaise: r.debitPaise,
      creditPaise: r.creditPaise,
      runningBalancePaise: running,
    });

    if (r.kind === "BILL") totals.billedPaise += r.debitPaise;
    else if (r.kind === "RECEIPT") {
      totals.receivedPaise += r.receiptCashPaise ?? 0;
      totals.tdsPaise += r.receiptTdsPaise ?? 0;
    } else totals.adjustmentsPaise += r.creditPaise - r.debitPaise;
  }

  const closingBalancePaise = ordered.length ? running : openingBalancePaise;
  totals.outstandingPaise = closingBalancePaise;

  return {
    customerId: meta.customerId,
    customerName: meta.customerName,
    openingBalancePaise,
    closingBalancePaise,
    lines,
    totals,
  };
}

export type BillLite = {
  id: string;
  billNumber: string | null;
  billDate: Date;
  dueDate: Date | null;
  totalAmountPaise: number;
};
export type SettlementLite = { billId: string; settledPaise: number; at: Date };
export type CreditNoteLite = { billId: string; amountPaise: number; at: Date };

/**
 * Per-bill outstanding as of `asOf`:
 *   outstanding = billTotal − Σ receipt settlements − Σ credit notes  (floored at 0)
 * A settlement / credit note dated after `asOf` is ignored; a bill dated after
 * `asOf` is excluded entirely.
 */
export function computeBillOutstanding(
  bills: BillLite[],
  settlements: SettlementLite[],
  creditNotes: CreditNoteLite[],
  asOf: Date,
): BillOutstandingRow[] {
  const settledByBill = new Map<string, number>();
  for (const s of settlements) {
    if (s.at > asOf) continue;
    settledByBill.set(s.billId, (settledByBill.get(s.billId) ?? 0) + s.settledPaise);
  }
  const cnByBill = new Map<string, number>();
  for (const c of creditNotes) {
    if (c.at > asOf) continue;
    cnByBill.set(c.billId, (cnByBill.get(c.billId) ?? 0) + c.amountPaise);
  }

  return bills
    .filter((b) => b.billDate <= asOf)
    .map((b) => {
      const settledPaise = settledByBill.get(b.id) ?? 0;
      const creditNotePaise = cnByBill.get(b.id) ?? 0;
      const outstandingPaise = Math.max(
        0,
        b.totalAmountPaise - settledPaise - creditNotePaise,
      );
      return {
        billId: b.id,
        billNumber: b.billNumber,
        billDate: iso(b.billDate),
        dueDate: b.dueDate ? iso(b.dueDate) : null,
        totalPaise: b.totalAmountPaise,
        settledPaise,
        creditNotePaise,
        outstandingPaise,
      };
    });
}
