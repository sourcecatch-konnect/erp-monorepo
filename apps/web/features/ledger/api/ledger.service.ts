import { api } from "@/lib/api";
import type { ApiResponse, LedgerView } from "@skerp/types";
import { unwrapApiResponse } from "../../masters/_shared/master-api";
import type { LedgerRange } from "./ledger.keys";

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
};
