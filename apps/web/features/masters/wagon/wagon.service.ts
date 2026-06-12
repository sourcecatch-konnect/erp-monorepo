import { api } from "@/lib/api";
import type {
  ApiResponse,
  Wagon,
  CreateWagonBody,
  UpdateWagonBody,
} from "@skerp/types";

import {
  ListQuery,
  ListResult,
  BulkImportResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../_shared/master-api";

export const wagonApi = {
  list: async (query?: ListQuery): Promise<ListResult<Wagon>> => {
    const res = await api.get<ApiResponse<Wagon[]>>("/wagons", {
      params: query,
    });

    return unwrapListResponse(res);
  },

  detail: async (id: string): Promise<Wagon> => {
    const res = await api.get<ApiResponse<Wagon>>(`/wagons/${id}`);

    return unwrapApiResponse(res);
  },

  create: async (body: CreateWagonBody): Promise<Wagon> => {
    const res = await api.post<ApiResponse<Wagon>>("/wagons", body);

    return unwrapApiResponse(res);
  },

  update: async (id: string, body: UpdateWagonBody): Promise<Wagon> => {
    const res = await api.patch<ApiResponse<Wagon>>(`/wagons/${id}`, body);

    return unwrapApiResponse(res);
  },

  remove: async (id: string): Promise<void> => {
    const res = await api.delete<ApiResponse<null>>(`/wagons/${id}`);
    unwrapApiResponse(res);
  },

  bulkRemove: async (ids: string[]) => {
    const res = await api.post<ApiResponse<{ count: number }>>(
      "/wagons/bulk-delete",
      { ids }
    );

    return unwrapApiResponse(res);
  },

  bulkImport: async (rows: CreateWagonBody[]) => {
    const res = await api.post<ApiResponse<BulkImportResult>>(
      "/wagons/bulk-import",
      { rows }
    );

    return unwrapApiResponse(res);
  },

  export: async (query?: ListQuery): Promise<Blob> => {
    const res = await api.get<Blob>("/wagons/export", {
      params: query,
      responseType: "blob",
    });

    return res.data;
  },

  search: async (q: string): Promise<Wagon[]> => {
    const res = await api.get<ApiResponse<Wagon[]>>("/wagons/search", {
      params: { q },
    });

    return unwrapApiResponse(res);
  },
};