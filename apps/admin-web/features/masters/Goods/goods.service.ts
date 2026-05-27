import { api } from "@/lib/api";
import type {
  ApiResponse,
  CreateGoodsBody,
  UpdateGoodsBody,
  Goods,
} from "@skerp/types";

import {
  ListQuery,
  ListResult,
  BulkImportResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../_shared/master-api";

export const goodsApi = {
  list: async (query?: ListQuery): Promise<ListResult<Goods>> => {
    const res = await api.get<ApiResponse<Goods[]>>("/goods", {
      params: query,
    });

    return unwrapListResponse(res);
  },

  detail: async (id: string): Promise<Goods> => {
    const res = await api.get<ApiResponse<Goods>>(`/goods/${id}`);

    return unwrapApiResponse(res);
  },

  create: async (body: CreateGoodsBody): Promise<Goods> => {
    const res = await api.post<ApiResponse<Goods>>("/goods", body);

    return unwrapApiResponse(res);
  },

  update: async (id: string, body: UpdateGoodsBody): Promise<Goods> => {
    const res = await api.patch<ApiResponse<Goods>>(`/goods/${id}`, body);

    return unwrapApiResponse(res);
  },

  remove: async (id: string): Promise<void> => {
    const res = await api.delete<ApiResponse<null>>(`/goods/${id}`);
    unwrapApiResponse(res);
  },

  bulkRemove: async (ids: string[]) => {
    const res = await api.post<ApiResponse<{ count: number }>>(
      "/goods/bulk-delete",
      { ids }
    );

    return unwrapApiResponse(res);
  },

  bulkImport: async (rows: CreateGoodsBody[]): Promise<BulkImportResult> => {
    const res = await api.post<ApiResponse<BulkImportResult>>(
      "/goods/bulk-import",
      { rows }
    );

    return unwrapApiResponse(res);
  },

  export: async (query?: ListQuery): Promise<Blob> => {
    const res = await api.get<Blob>("/goods/export", {
      params: query,
      responseType: "blob",
    });

    return res.data;
  },

  search: async (q: string): Promise<Goods[]> => {
    const res = await api.get<ApiResponse<Goods[]>>("/goods/search", {
      params: { q },
    });

    return unwrapApiResponse(res);
  },
};