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
