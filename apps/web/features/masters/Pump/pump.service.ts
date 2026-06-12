import { api } from "@/lib/api";
import type {
  ApiResponse,
  Pump,
  CreatePumpBody,
  UpdatePumpBody,
} from "@skerp/types";

import {
  ListQuery,
  ListResult,
  BulkImportResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../_shared/master-api";

export const pumpApi = {
  list: async (query?: ListQuery): Promise<ListResult<Pump>> => {
    const res = await api.get<ApiResponse<Pump[]>>("/pumps", {
      params: query,
    });

    return unwrapListResponse(res);
  },

  detail: async (id: string): Promise<Pump> => {
    const res = await api.get<ApiResponse<Pump>>(`/pumps/${id}`);

    return unwrapApiResponse(res);
  },

  create: async (body: CreatePumpBody): Promise<Pump> => {
    const res = await api.post<ApiResponse<Pump>>("/pumps", body);

    return unwrapApiResponse(res);
  },

  update: async (id: string, body: UpdatePumpBody): Promise<Pump> => {
    const res = await api.patch<ApiResponse<Pump>>(`/pumps/${id}`, body);

    return unwrapApiResponse(res);
  },

  remove: async (id: string): Promise<void> => {
    const res = await api.delete<ApiResponse<null>>(`/pumps/${id}`);
    unwrapApiResponse(res);
  },

  bulkRemove: async (ids: string[]) => {
    const res = await api.post<ApiResponse<{ count: number }>>(
      "/pumps/bulk-delete",
      { ids }
    );

    return unwrapApiResponse(res);
  },

  bulkImport: async (rows: CreatePumpBody[]) => {
    const res = await api.post<ApiResponse<BulkImportResult>>(
      "/pumps/bulk-import",
      { rows }
    );

    return unwrapApiResponse(res);
  },

  export: async (query?: ListQuery): Promise<Blob> => {
    const res = await api.get<Blob>("/pumps/export", {
      params: query,
      responseType: "blob",
    });

    return res.data;
  },

  search: async (q: string): Promise<Pump[]> => {
    const res = await api.get<ApiResponse<Pump[]>>("/pumps/search", {
      params: { q },
    });

    return unwrapApiResponse(res);
  },
};