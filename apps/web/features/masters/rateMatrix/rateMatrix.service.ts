import { api } from "@/lib/api";

import type {
  ApiResponse,
  RateMatrix,
  CreateRateMatrixBody,
  UpdateRateMatrixBody,
} from "@skerp/types";

import {
  ListQuery,
  ListResult,
  BulkImportResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../_shared/master-api";

export const rateMatrixApi = {
  list: async (query?: ListQuery): Promise<ListResult<RateMatrix>> => {
    const res = await api.get<ApiResponse<RateMatrix[]>>("/rateMatrix", {
      params: query,
    });

    return unwrapListResponse(res);
  },

  detail: async (id: string): Promise<RateMatrix> => {
    const res = await api.get<ApiResponse<RateMatrix>>(`/rateMatrix/${id}`);
    return unwrapApiResponse(res);
  },

  create: async (body: CreateRateMatrixBody): Promise<RateMatrix> => {
    const res = await api.post<ApiResponse<RateMatrix>>("/rateMatrix", body);
    return unwrapApiResponse(res);
  },

  update: async (
    id: string,
    body: UpdateRateMatrixBody
  ): Promise<RateMatrix> => {
    const res = await api.patch<ApiResponse<RateMatrix>>(
      `/rateMatrix/${id}`,
      body
    );

    return unwrapApiResponse(res);
  },

  remove: async (id: string): Promise<void> => {
    const res = await api.delete<ApiResponse<null>>(`/rateMatrix/${id}`);
    unwrapApiResponse(res);
  },

  bulkRemove: async (ids: string[]) => {
    const res = await api.post<ApiResponse<{ count: number }>>(
      "/rateMatrix/bulk-delete",
      { ids }
    );

    return unwrapApiResponse(res);
  },

  bulkImport: async (rows: CreateRateMatrixBody[]) => {
    const res = await api.post<ApiResponse<BulkImportResult>>(
      "/rateMatrix/bulk-import",
      { rows }
    );

    return unwrapApiResponse(res);
  },

  export: async (query?: ListQuery): Promise<Blob> => {
    const res = await api.get<Blob>("/rateMatrix/export", {
      params: query,
      responseType: "blob",
    });

    return res.data;
  },

  search: async (q: string): Promise<RateMatrix[]> => {
    const res = await api.get<ApiResponse<RateMatrix[]>>(
      "/rateMatrix/search",
      {
        params: { q },
      }
    );

    return unwrapApiResponse(res);
  },
};