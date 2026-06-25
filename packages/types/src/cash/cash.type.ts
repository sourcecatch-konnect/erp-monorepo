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
  cashPlanDaySchema,
  cashAccountBalanceSchema,
  openCashDaySchema,
  upsertCashBalancesSchema,
  closeCashDaySchema,
  cashReceivableSchema,
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

/* ---- Receivable ---- */
export type CashReceivable = z.infer<typeof cashReceivableSchema>;
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

/* ---- Composite read shapes (API responses) ---- */
export type CashPaymentWithCreditor = CashPayment & {
  creditor?: Pick<Creditor, "id" | "name" | "category"> | null;
  fromAccount?: Pick<CashAccount, "id" | "name" | "type"> | null;
  branch?: { id: string; name: string } | null;
};

export type CashAccountBalanceWithAccount = CashAccountBalance & {
  account: Pick<CashAccount, "id" | "name" | "type">;
  /** opening − approved payments tagged to this account, computed server-side */
  closingBalance: number;
};

/** Full daily cash-planning view returned by GET the day. */
export type CashPlanDayView = CashPlanDay & {
  balances: CashAccountBalanceWithAccount[];
  /** ordered by priority asc (top = pay first) */
  payments: CashPaymentWithCreditor[];
  receivables: CashReceivable[];
  /** Σ opening balances (paise) */
  totalOpening: number;
  /** Σ approved payments (paise) */
  approvedTotal: number;
  /** Σ pending payments (paise) */
  pendingTotal: number;
  /** totalOpening − approvedTotal (paise) */
  availableCash: number;
  /** Σ expected receivables not yet received (paise) */
  expectedReceivables: number;
  /** availableCash + expectedReceivables (paise) — short forecast */
  projectedCash: number;
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
