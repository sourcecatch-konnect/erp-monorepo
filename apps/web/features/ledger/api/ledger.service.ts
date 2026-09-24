import { api } from "@/lib/api";
import type {
  ApiResponse,
  AgeingReportView,
  BillOutstandingRow,
  CustomerStatementView,
  LedgerView,
  SlipOutstandingRow,
  VendorStatementView,
} from "@skerp/types";
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
  // Party FKs — the server sends every scalar column by default (no
  // `select` on that query), so these are already on the wire; only a GL
  // ledger's counterpart-master row is non-null, and exactly one of them.
  customerId?: string | null;
  transportId?: string | null;
  creditorId?: string | null;
  labourId?: string | null;
  pumpId?: string | null;
  sparePartSupplierId?: string | null;
};

export type VendorType = "TRANSPORTER" | "LABOUR";

/** Which SUNDRY_CREDITOR ledgers count as a "vendor" (has a vendor-payment
 *  statement) vs a plain creditor/supplier (only the flat ledger view). */
export function vendorTypeOf(account: LedgerAccount): VendorType | null {
  if (account.transportId) return "TRANSPORTER";
  if (account.labourId) return "LABOUR";
  return null;
}

export type ChartOfAccountsFilters = {
  kind?: LedgerKind;
  group?: LedgerAccountGroup;
  /** Several groups in one request; wins over `group` when both are set. */
  groups?: LedgerAccountGroup[];
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

export type StatementFilters = {
  branchId?: string;
  fyCode?: string;
  from?: string;
  to?: string;
};

export type AgeingFilters = {
  branchId?: string;
  fyCode?: string;
  asOf?: string;
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

  // --- ACCT-R: customer statement / bill-wise outstanding / ageing ---

  customerStatement: async (
    id: string,
    filters: StatementFilters = {},
  ): Promise<CustomerStatementView> => {
    const res = await api.get<ApiResponse<CustomerStatementView>>(
      `/ledger/customers/${id}/statement`,
      { params: filters },
    );
    return unwrapApiResponse(res);
  },

  // --- VP-8: vendor statement / slip-wise outstanding ---

  vendorStatement: async (
    ledgerId: string,
    filters: StatementFilters = {},
  ): Promise<VendorStatementView> => {
    const res = await api.get<ApiResponse<VendorStatementView>>(
      `/ledger/vendors/${ledgerId}/statement`,
      { params: filters },
    );
    return unwrapApiResponse(res);
  },

  slipsOutstanding: async (
    ledgerId: string,
    filters: StatementFilters = {},
  ): Promise<SlipOutstandingRow[]> => {
    const res = await api.get<ApiResponse<SlipOutstandingRow[]>>(
      `/ledger/vendors/${ledgerId}/slips-outstanding`,
      { params: filters },
    );
    return unwrapApiResponse(res);
  },

  billsOutstanding: async (
    id: string,
    filters: StatementFilters = {},
  ): Promise<BillOutstandingRow[]> => {
    const res = await api.get<ApiResponse<BillOutstandingRow[]>>(
      `/ledger/customers/${id}/bills-outstanding`,
      { params: filters },
    );
    return unwrapApiResponse(res);
  },

  ageing: async (filters: AgeingFilters = {}): Promise<AgeingReportView> => {
    const res = await api.get<ApiResponse<AgeingReportView>>("/ledger/ageing", {
      params: filters,
    });
    return unwrapApiResponse(res);
  },

  /** Server-generated statement export (ACCT-R6) — PDF or Excel, as a Blob so
   *  it goes through the same cookie auth as every other API call. */
  downloadStatement: async (
    id: string,
    filters: StatementFilters,
    format: "pdf" | "xlsx",
  ): Promise<Blob> => {
    const res = await api.get(`/ledger/customers/${id}/statement/${format}`, {
      params: filters,
      responseType: "blob",
    });
    return res.data as Blob;
  },

  // --- Phase 4: chart of accounts / manual journal / day book ---

  chartOfAccounts: (filters: ChartOfAccountsFilters = {}) =>
    get<LedgerAccount[]>("/ledger/accounts", {
      kind: filters.kind,
      group: filters.group,
      groups: filters.groups?.length ? filters.groups.join(",") : undefined,
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
