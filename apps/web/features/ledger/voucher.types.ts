// Shared double-entry voucher types — used by both the Billing (SALES
// voucher) and Receivables (RECEIPT voucher) features, since both view the
// same JournalEntry shape via GET .../voucher.

export type VoucherType =
  | "SALES"
  | "RECEIPT"
  | "PAYMENT"
  | "JOURNAL"
  | "CONTRA"
  | "CREDIT_NOTE"
  | "DEBIT_NOTE";
export type JournalStatus = "DRAFT" | "POSTED" | "REVERSED";
export type TallySyncStatus = "NOT_SYNCED" | "SYNCED" | "FAILED";

export type JournalLine = {
  id: string;
  lineNumber: number;
  debitPaise: string;
  creditPaise: string;
  narration: string | null;
  ledger: {
    id: string;
    name: string;
    code: string | null;
    kind: "PARTY" | "GL";
    group?: string;
  };
};

export type JournalAllocation = {
  id: string;
  /** null for a vendor-payment-slip allocation (not a bill). */
  billId: string | null;
  refType: "NEW_REF" | "AGAINST_REF";
  amountPaise: string;
  bill?: { id: string; billNumber: string | null };
};

export type Voucher = {
  id: string;
  voucherType: VoucherType;
  voucherNumber: string;
  voucherDate: string;
  fyCode: string;
  narration: string | null;
  status: JournalStatus;
  sourceType: string;
  sourceNumber: string | null;
  tallyMasterId: string | null;
  tallySyncStatus: TallySyncStatus;
  tallySyncedAt: string | null;
  tallySyncError: string | null;
  tallySyncAttempts: number;
  createdAt: string;
  branch?: { id: string; name: string; branchCode: string };
  createdBy?: { id: string; firstName: string; lastName: string };
  lines: JournalLine[];
  allocations: JournalAllocation[];
};
