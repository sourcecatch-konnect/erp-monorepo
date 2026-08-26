import { z } from "zod";
import {
  creditorSchema,
  createCreditorSchema,
  updateCreditorSchema,
  cashAccountSchema,
  createCashAccountSchema,
  updateCashAccountSchema,
  cashPaymentSchema,
  createCashPaymentSchema,
  updateCashPaymentSchema,
  cashPaymentStatusUpdateSchema,
  reorderCashPaymentsSchema,
  bulkApproveCashPaymentsSchema,
  cashPlanDaySchema,
  cashAccountBalanceSchema,
  openCashDaySchema,
  upsertCashBalancesSchema,
  closeCashDaySchema,
  cashAccountAdjustmentSchema,
  createCashAccountAdjustmentSchema,
  cashReceivableSchema,
  cashReceiptSchema,
  createCashReceivableSchema,
  updateCashReceivableSchema,
  markReceivableReceivedSchema,
  creditorCategorySchema,
  paymentModeSchema,
  paymentStatusSchema,
  cashSegmentSchema,
  cashAccountTypeSchema,
  cashDayStatusSchema,
} from "@skerp/validators";

/* ---- Enums ---- */
export type CreditorCategory = z.infer<typeof creditorCategorySchema>;
export type PaymentMode = z.infer<typeof paymentModeSchema>;
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export type CashSegment = z.infer<typeof cashSegmentSchema>;
export type CashAccountType = z.infer<typeof cashAccountTypeSchema>;
export type CashDayStatus = z.infer<typeof cashDayStatusSchema>;

/* ---- Creditor ---- */
export type Creditor = z.infer<typeof creditorSchema>;
export type CreateCreditorBody = z.output<typeof createCreditorSchema>;
export type UpdateCreditorBody = z.output<typeof updateCreditorSchema>;
export type CreateCreditorFormInput = z.input<typeof createCreditorSchema>;
export type UpdateCreditorFormInput = z.input<typeof updateCreditorSchema>;

/* ---- Cash Account ---- */
export type CashAccount = z.infer<typeof cashAccountSchema>;
export type CreateCashAccountBody = z.output<typeof createCashAccountSchema>;
export type UpdateCashAccountBody = z.output<typeof updateCashAccountSchema>;
export type CreateCashAccountFormInput = z.input<typeof createCashAccountSchema>;
export type UpdateCashAccountFormInput = z.input<typeof updateCashAccountSchema>;

/* ---- Payment ---- */
export type CashPayment = z.infer<typeof cashPaymentSchema>;
export type CreateCashPaymentBody = z.output<typeof createCashPaymentSchema>;
export type UpdateCashPaymentBody = z.output<typeof updateCashPaymentSchema>;
export type CreateCashPaymentFormInput = z.input<typeof createCashPaymentSchema>;
export type CashPaymentStatusUpdateBody = z.output<
  typeof cashPaymentStatusUpdateSchema
>;
export type ReorderCashPaymentsBody = z.output<
  typeof reorderCashPaymentsSchema
>;
export type BulkApproveCashPaymentsBody = z.output<
  typeof bulkApproveCashPaymentsSchema
>;

/* ---- Receivable ---- */
export type CashReceivable = z.infer<typeof cashReceivableSchema>;
export type CashReceipt = z.infer<typeof cashReceiptSchema>;
export type CreateCashReceivableBody = z.output<
  typeof createCashReceivableSchema
>;
export type UpdateCashReceivableBody = z.output<
  typeof updateCashReceivableSchema
>;
export type MarkReceivableReceivedBody = z.output<
  typeof markReceivableReceivedSchema
>;

/* ---- Day & balances ---- */
export type CashPlanDay = z.infer<typeof cashPlanDaySchema>;
export type CashAccountBalance = z.infer<typeof cashAccountBalanceSchema>;
export type OpenCashDayBody = z.output<typeof openCashDaySchema>;
export type UpsertCashBalancesBody = z.output<typeof upsertCashBalancesSchema>;
export type CloseCashDayBody = z.output<typeof closeCashDaySchema>;

/* ---- Account adjustments (manual add funds / receipt credit) ---- */
export type CashAccountAdjustment = z.infer<typeof cashAccountAdjustmentSchema>;
export type CreateCashAccountAdjustmentBody = z.output<
  typeof createCashAccountAdjustmentSchema
>;

/* ---- Composite read shapes (API responses) ---- */
export type CashPaymentWithCreditor = CashPayment & {
  creditor?: Pick<Creditor, "id" | "name" | "category"> | null;
  fromAccount?: Pick<CashAccount, "id" | "name" | "type"> | null;
  branch?: { id: string; name: string } | null;
};

export type CashAccountBalanceWithAccount = CashAccountBalance & {
  account: Pick<CashAccount, "id" | "name" | "type">;
  /** Σ manual/receipt adjustments posted to this account today (paise) */
  adjustmentsTotal: number;
  /** Σ money in today: positive adjustments — receipt credits + manual "add funds" (paise) */
  receivedTotal: number;
  /** Σ money out today: approved payments tagged to this account + negative/correction adjustments (paise) */
  paymentTotal: number;
  /** opening − approved payments + adjustments for this account, computed server-side */
  closingBalance: number;
};

/** Full daily cash-planning view returned by GET the day. */
export type CashPlanDayView = CashPlanDay & {
  balances: CashAccountBalanceWithAccount[];
  /** ordered by priority asc (top = pay first) */
  payments: CashPaymentWithCreditor[];
  /** every manual/receipt adjustment posted today, across all accounts */
  adjustments: CashAccountAdjustment[];
  /** Σ opening balances (paise) */
  totalOpening: number;
  /** Σ approved payments (paise) */
  approvedTotal: number;
  /** Σ pending payments (paise) */
  pendingTotal: number;
  /** Σ manual/receipt adjustments posted today, across all accounts (paise) */
  totalAdjustments: number;
  /** Σ receivedTotal across all accounts (paise) */
  totalReceived: number;
  /** Σ paymentTotal across all accounts (paise) */
  totalPayment: number;
  /** totalOpening + totalAdjustments − approvedTotal (paise) */
  availableCash: number;
};

/**
 * Global receivables ledger. Receivables are no longer tied to a day; the
 * day forecast combines `availableCash` with the expected slices due by it.
 */
/** A receivable plus its receipt timeline (newest first). */
export type CashReceivableWithReceipts = CashReceivable & {
  receipts: CashReceipt[];
};

export type ReceivablesView = {
  receivables: CashReceivableWithReceipts[];
  /** Σ outstanding of receivables not yet fully settled (paise) */
  totalPending: number;
  /** Σ next-expected slice of receivables not yet fully settled (paise) */
  totalExpected: number;
};

/** A category group in the creditor ledger view. */
export type CreditorLedgerGroup = {
  category: CreditorCategory;
  creditors: Pick<Creditor, "id" | "name" | "outstandingBalance">[];
  /** Σ outstanding in this category (paise) */
  subtotal: number;
};

/** Creditor ledger grouped by category with auto subtotals + grand total. */
export type CreditorLedgerView = {
  groups: CreditorLedgerGroup[];
  /** Σ all outstanding (paise) */
  grandTotal: number;
};
