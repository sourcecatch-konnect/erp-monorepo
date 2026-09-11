import { z } from "zod";
import {
  ledgerDirectionSchema,
  ledgerSourceTypeSchema,
  ledgerEntrySchema,
  ledgerQuerySchema,
} from "@skerp/validators";

export type LedgerDirection = z.infer<typeof ledgerDirectionSchema>;
export type LedgerSourceType = z.infer<typeof ledgerSourceTypeSchema>;
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;
export type LedgerQuery = z.output<typeof ledgerQuerySchema>;

/** One ledger row plus its running balance for the account/party being viewed. */
export type LedgerEntryRow = LedgerEntry & {
  /** Signed running balance after this entry, in the order the ledger is sorted (paise) */
  runningBalance: number;
};

/** Full response for one of the 5 ledger reports (Bank/Cash/Debtor/Creditor/Expense). */
export type LedgerView = {
  entries: LedgerEntryRow[];
  /** Balance carried into the first entry in this view (paise) */
  openingBalance: number;
  /** Balance after the last entry in this view — equals openingBalance if entries is empty (paise) */
  closingBalance: number;
  /** Σ amountPaise where direction === "IN" */
  totalIn: number;
  /** Σ amountPaise where direction === "OUT" */
  totalOut: number;
};

/* ------------------------------------------------------------------ */
/* Customer Statement (ACCT-R2) — the real Debtor picture: bills +    */
/* receipts + credit/debit notes + manual JV adjustments, in date     */
/* order, with a running Dr-positive balance. Read directly from      */
/* Bill / Receipt / ReceiptAllocation + JournalEntry (CN/DN/JV on the */
/* customer's party ledger). NOT from LedgerEntry.                    */
/* ------------------------------------------------------------------ */

export type StatementLineKind =
  | "BILL"
  | "RECEIPT"
  | "CREDIT_NOTE"
  | "DEBIT_NOTE"
  | "JOURNAL";

/** One row of a customer statement. All money in paise; `debitPaise` raises
 *  what the customer owes, `creditPaise` reduces it. Exactly one is > 0
 *  except an opening/rounding line. */
export type StatementLine = {
  /** Source row id — Bill.id / Receipt.id / JournalEntry.id */
  id: string;
  /** Business date of the event (ISO string): billDate / receivedAt / voucherDate */
  date: string;
  kind: StatementLineKind;
  /** Human label, e.g. "Bill SKT/B/DEL/26-27/0012" or "Receipt — UPI" */
  particulars: string;
  /** Document number if the source has one */
  voucherNumber: string | null;
  /** Id to drill into (same as `id` today, kept separate for future CN screens) */
  voucherId: string | null;
  /** Web path to open the source record, or null if none exists yet */
  href: string | null;
  debitPaise: number;
  creditPaise: number;
  /** Dr-positive running balance after this line (paise) */
  runningBalancePaise: number;
};

export type CustomerStatementTotals = {
  /** Σ bill totals in range (paise) */
  billedPaise: number;
  /** Σ cash actually received in range — amountApplied only, excludes TDS/damage/rateDiff (paise) */
  receivedPaise: number;
  /** Σ TDS deducted on receipts in range (paise) */
  tdsPaise: number;
  /** Net effect of CN/DN/JV lines in range — credit-positive (paise) */
  adjustmentsPaise: number;
  /**
   * Σ receipt cash received but not yet applied to any bill, as of `to` (paise).
   * Reported for visibility only — it does NOT move the running balance, so
   * that `closingBalancePaise` stays equal to Σ bill-wise outstanding (R4/R5).
   */
  onAccountPaise: number;
  /** Closing balance — what the customer owes as of `to` (paise, Dr-positive) */
  outstandingPaise: number;
};

export type CustomerStatementView = {
  customerId: string;
  customerName: string;
  /** Balance carried into the first in-range line (paise, Dr-positive) */
  openingBalancePaise: number;
  /** Balance after the last in-range line (paise, Dr-positive) */
  closingBalancePaise: number;
  lines: StatementLine[];
  totals: CustomerStatementTotals;
};

/* ------------------------------------------------------------------ */
/* Bill-wise outstanding (ACCT-R4) — per bill, how much is still      */
/* unpaid, plus its due date (Ageing needs both).                     */
/* ------------------------------------------------------------------ */

export type BillOutstandingRow = {
  billId: string;
  billNumber: string | null;
  billDate: string;
  dueDate: string | null;
  totalPaise: number;
  /** Σ receipt allocations settled against this bill (amountApplied+tds+damage+rateDiff) */
  settledPaise: number;
  /** Σ credit notes applied against this bill */
  creditNotePaise: number;
  /** totalPaise − settledPaise − creditNotePaise (never < 0) */
  outstandingPaise: number;
};

/* ------------------------------------------------------------------ */
/* Ageing report (ACCT-R5) — one row per customer, unpaid bills       */
/* bucketed by (asOf − dueDate).                                      */
/* ------------------------------------------------------------------ */

export type AgeingBucketKey = "notDue" | "d0_30" | "d31_60" | "d61_90" | "d90_plus";

export type AgeingBuckets = Record<AgeingBucketKey, number>;

export type AgeingRow = {
  customerId: string;
  customerName: string;
  buckets: AgeingBuckets;
  totalPaise: number;
};

export type AgeingReportView = {
  /** As-of date the ageing was computed for (ISO date string) */
  asOf: string;
  rows: AgeingRow[];
  /** Column sums across all customers, plus the grand total */
  totals: AgeingBuckets & { totalPaise: number };
};
