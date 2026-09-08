import type { ChartOfAccountsFilters, DayBookFilters } from "./ledger.service";

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
  chartOfAccounts: (filters?: ChartOfAccountsFilters) =>
    [...ledgerKeys.all, "chart-of-accounts", filters] as const,
  dayBook: (filters?: DayBookFilters) =>
    [...ledgerKeys.all, "day-book", filters] as const,
  voucher: (id: string) => [...ledgerKeys.all, "voucher", id] as const,
};
