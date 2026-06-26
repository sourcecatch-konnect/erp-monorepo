import { api } from "@/lib/api";
import type {
  ApiResponse,
  CashAccount,
  CreateCashAccountBody,
  UpdateCashAccountBody,
} from "@skerp/types";
import {
  ListQuery,
  ListResult,
  BulkImportResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../_shared/master-api";

export const cashAccountApi = {
  list: async (query?: ListQuery): Promise<ListResult<CashAccount>> => {
    const res = await api.get<ApiResponse<CashAccount[]>>("/cash-accounts", {
      params: query,
    });
    return unwrapListResponse(res);
  },

  detail: async (id: string): Promise<CashAccount> => {
    const res = await api.get<ApiResponse<CashAccount>>(`/cash-accounts/${id}`);
    return unwrapApiResponse(res);
  },

  create: async (body: CreateCashAccountBody): Promise<CashAccount> => {
    const res = await api.post<ApiResponse<CashAccount>>("/cash-accounts", body);
    return unwrapApiResponse(res);
  },

  update: async (
    id: string,
    body: UpdateCashAccountBody,
  ): Promise<CashAccount> => {
    const res = await api.patch<ApiResponse<CashAccount>>(
      `/cash-accounts/${id}`,
      body,
    );
    return unwrapApiResponse(res);
  },

  remove: async (id: string): Promise<void> => {
    const res = await api.delete<ApiResponse<null>>(`/cash-accounts/${id}`);
    unwrapApiResponse(res);
  },

  bulkRemove: async (ids: string[]) => {
    const res = await api.post<ApiResponse<{ count: number }>>(
      "/cash-accounts/bulk-delete",
      { ids },
    );
    return unwrapApiResponse(res);
  },

  bulkImport: async (
    rows: CreateCashAccountBody[],
  ): Promise<BulkImportResult> => {
    const res = await api.post<ApiResponse<BulkImportResult>>(
      "/cash-accounts/bulk-import",
      { rows },
    );
    return unwrapApiResponse(res);
  },

  export: async (query?: ListQuery): Promise<Blob> => {
    const res = await api.get<Blob>("/cash-accounts/export", {
      params: query,
      responseType: "blob",
    });
    return res.data;
  },

  search: async (q: string): Promise<CashAccount[]> => {
    const res = await api.get<ApiResponse<CashAccount[]>>(
      "/cash-accounts/search",
      { params: { q } },
    );
    return unwrapApiResponse(res);
  },
};
