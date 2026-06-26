import { api } from "@/lib/api";
import type {
  ApiResponse,
  Creditor,
  CreateCreditorBody,
  UpdateCreditorBody,
} from "@skerp/types";
import {
  ListQuery,
  ListResult,
  BulkImportResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../_shared/master-api";

export const creditorApi = {
  list: async (query?: ListQuery): Promise<ListResult<Creditor>> => {
    const res = await api.get<ApiResponse<Creditor[]>>("/creditors", {
      params: query,
    });
    return unwrapListResponse(res);
  },

  detail: async (id: string): Promise<Creditor> => {
    const res = await api.get<ApiResponse<Creditor>>(`/creditors/${id}`);
    return unwrapApiResponse(res);
  },

  create: async (body: CreateCreditorBody): Promise<Creditor> => {
    const res = await api.post<ApiResponse<Creditor>>("/creditors", body);
    return unwrapApiResponse(res);
  },

  update: async (id: string, body: UpdateCreditorBody): Promise<Creditor> => {
    const res = await api.patch<ApiResponse<Creditor>>(`/creditors/${id}`, body);
    return unwrapApiResponse(res);
  },

  remove: async (id: string): Promise<void> => {
    const res = await api.delete<ApiResponse<null>>(`/creditors/${id}`);
    unwrapApiResponse(res);
  },

  bulkRemove: async (ids: string[]) => {
    const res = await api.post<ApiResponse<{ count: number }>>(
      "/creditors/bulk-delete",
      { ids },
    );
    return unwrapApiResponse(res);
  },

  bulkImport: async (rows: CreateCreditorBody[]): Promise<BulkImportResult> => {
    const res = await api.post<ApiResponse<BulkImportResult>>(
      "/creditors/bulk-import",
      { rows },
    );
    return unwrapApiResponse(res);
  },

  export: async (query?: ListQuery): Promise<Blob> => {
    const res = await api.get<Blob>("/creditors/export", {
      params: query,
      responseType: "blob",
    });
    return res.data;
  },

  search: async (q: string): Promise<Creditor[]> => {
    const res = await api.get<ApiResponse<Creditor[]>>("/creditors/search", {
      params: { q },
    });
    return unwrapApiResponse(res);
  },
};
