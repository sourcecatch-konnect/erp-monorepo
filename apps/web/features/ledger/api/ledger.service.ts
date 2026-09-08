import { api } from "@/lib/api";
import type { ApiResponse, LedgerView } from "@skerp/types";
import { unwrapApiResponse } from "../../masters/_shared/master-api";
import type { LedgerRange } from "./ledger.keys";
import type {
  JournalStatus,
  VoucherType,
  Voucher,
} from "../voucher.types";

export type LedgerKind = "PARTY" | "GL";
export type LedgerAccountGroup =
  | "SUNDRY_DEBTOR"
  | "SUNDRY_CREDITOR"
  | "DIRECT_INCOME"
  | "INDIRECT_INCOME"
  | "DIRECT_EXPENSE"
  | "INDIRECT_EXPENSE"
  | "DUTIES_AND_TAXES"
  | "BANK"
  | "CASH"
  | "CURRENT_ASSET"
  | "CURRENT_LIABILITY";

export type LedgerAccount = {
  id: string;
  kind: LedgerKind;
  name: string;
  group: LedgerAccountGroup;
  code: string | null;
  isActive: boolean;
  branchId: string | null;
  branch: { id: string; name: string; branchCode: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type ChartOfAccountsFilters = {
  kind?: LedgerKind;
  group?: LedgerAccountGroup;
  search?: string;
  isActive?: boolean;
};

export type CreateGLLedgerInput = {
  name: string;
  group: LedgerAccountGroup;
  code?: string;
  branchId?: string;
};

export type UpdateLedgerInput = {
  name?: string;
  group?: LedgerAccountGroup;
  code?: string | null;
  isActive?: boolean;
};

export type ManualJournalLineInput = {
  ledgerId: string;
  debitPaise: string;
  creditPaise: string;
  narration?: string;
};

export type CreateManualJournalInput = {
  branchId: string;
  voucherDate: string;
  narration?: string;
  lines: ManualJournalLineInput[];
};

export type DayBookFilters = {
  from: string;
  to?: string;
  branchId?: string;
  voucherType?: VoucherType;
};

export type DayBookEntry = {
  id: string;
  voucherType: VoucherType;
  voucherNumber: string;
  voucherDate: string;
  status: JournalStatus;
  narration: string | null;
  sourceType: string;
  branch: { id: string; name: string; branchCode: string };
  totalPaise: string;
  lineCount: number;
};

const get = async <T>(url: string, params?: Record<string, string | undefined>) => {
  const response = await api.get<ApiResponse<T>>(url, { params });
  return unwrapApiResponse(response);
};

const post = async <T>(url: string, body?: unknown) => {
  const response = await api.post<ApiResponse<T>>(url, body ?? {});
  return unwrapApiResponse(response);
};

const patch = async <T>(url: string, body?: unknown) => {
  const response = await api.patch<ApiResponse<T>>(url, body ?? {});
  return unwrapApiResponse(response);
};

export const ledgerApi = {
  forAccount: async (id: string, range: LedgerRange = {}): Promise<LedgerView> => {
    const res = await api.get<ApiResponse<LedgerView>>(`/ledger/cash-accounts/${id}`, {
      params: range,
    });
    return unwrapApiResponse(res);
  },

  forCustomer: async (id: string, range: LedgerRange = {}): Promise<LedgerView> => {
    const res = await api.get<ApiResponse<LedgerView>>(`/ledger/customers/${id}`, {
      params: range,
    });
    return unwrapApiResponse(res);
  },

  forCreditor: async (id: string, range: LedgerRange = {}): Promise<LedgerView> => {
    const res = await api.get<ApiResponse<LedgerView>>(`/ledger/creditors/${id}`, {
      params: range,
    });
    return unwrapApiResponse(res);
  },

  expenses: async (range: LedgerRange = {}): Promise<LedgerView> => {
    const res = await api.get<ApiResponse<LedgerView>>("/ledger/expenses", {
      params: range,
    });
    return unwrapApiResponse(res);
  },

  // --- Phase 4: chart of accounts / manual journal / day book ---

  chartOfAccounts: (filters: ChartOfAccountsFilters = {}) =>
    get<LedgerAccount[]>("/ledger/accounts", {
      kind: filters.kind,
      group: filters.group,
      search: filters.search,
      isActive: filters.isActive === undefined ? undefined : String(filters.isActive),
    }),
  createGLLedger: (body: CreateGLLedgerInput) =>
    post<LedgerAccount>("/ledger/accounts", body),
  updateLedger: (id: string, body: UpdateLedgerInput) =>
    patch<LedgerAccount>(`/ledger/accounts/${id}`, body),
  createManualJournal: (body: CreateManualJournalInput) =>
    post<{ id: string; voucherNumber: string }>("/ledger/journal", body),
  dayBook: (filters: DayBookFilters) =>
    get<DayBookEntry[]>("/ledger/day-book", {
      from: filters.from,
      to: filters.to,
      branchId: filters.branchId,
      voucherType: filters.voucherType,
    }),
  voucher: (id: string) => get<Voucher>(`/ledger/vouchers/${id}`),
};
