import type {
  AgeingFilters,
  ChartOfAccountsFilters,
  DayBookFilters,
  StatementFilters,
} from "./ledger.service";

export type LedgerRange = { from?: string; to?: string };

export const ledgerKeys = {
  all: ["ledger"] as const,
  account: (id: string, range?: LedgerRange) =>
    [...ledgerKeys.all, "account", id, range] as const,
  customer: (id: string, range?: LedgerRange) =>
    [...ledgerKeys.all, "customer", id, range] as const,
  creditor: (id: string, range?: LedgerRange) =>
    [...ledgerKeys.all, "creditor", id, range] as const,
  expenses: (range?: LedgerRange) =>
    [...ledgerKeys.all, "expenses", range] as const,
  statement: (id: string, filters?: StatementFilters) =>
    [...ledgerKeys.all, "statement", id, filters] as const,
  billsOutstanding: (id: string, filters?: StatementFilters) =>
    [...ledgerKeys.all, "bills-outstanding", id, filters] as const,
  vendorStatement: (ledgerId: string, filters?: StatementFilters) =>
    [...ledgerKeys.all, "vendor-statement", ledgerId, filters] as const,
  slipsOutstanding: (ledgerId: string, filters?: StatementFilters) =>
    [...ledgerKeys.all, "slips-outstanding", ledgerId, filters] as const,
  ageing: (filters?: AgeingFilters) =>
    [...ledgerKeys.all, "ageing", filters] as const,
  chartOfAccounts: (filters?: ChartOfAccountsFilters) =>
    [...ledgerKeys.all, "chart-of-accounts", filters] as const,
  dayBook: (filters?: DayBookFilters) =>
    [...ledgerKeys.all, "day-book", filters] as const,
  voucher: (id: string) => [...ledgerKeys.all, "voucher", id] as const,
};
