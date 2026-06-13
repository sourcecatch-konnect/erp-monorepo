import { api } from "@/lib/api";

import type {
  ApiResponse,
  CreateSpareCategoryBody,
  SpareCategory,
  UpdateSpareCategoryBody,
  
} from "@skerp/types";

import {
  ListQuery,
  ListResult,
  BulkImportResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../_shared/master-api";

export const spareCategoryApi = {
  list: async (
    query?: ListQuery
  ): Promise<ListResult<SpareCategory>> => {
    const res = await api.get<ApiResponse<SpareCategory[]>>(
      "/spare-category",
      {
        params: query,
      }
    );

    return unwrapListResponse(res);
  },

  detail: async (id: string): Promise<SpareCategory> => {
    const res = await api.get<ApiResponse<SpareCategory>>(
      `/spare-category/${id}`
    );

    return unwrapApiResponse(res);
  },

  create: async (
    body: CreateSpareCategoryBody
  ): Promise<SpareCategory> => {
    const res = await api.post<ApiResponse<SpareCategory>>(
      "/spare-category",
      body
    );

    return unwrapApiResponse(res);
  },

  update: async (
    id: string,
    body: UpdateSpareCategoryBody
  ): Promise<SpareCategory> => {
    const res = await api.patch<ApiResponse<SpareCategory>>(
      `/spare-category/${id}`,
      body
    );

    return unwrapApiResponse(res);
  },

  remove: async (id: string): Promise<void> => {
    const res = await api.delete<ApiResponse<null>>(
      `/spare-category/${id}`
    );

    unwrapApiResponse(res);
  },

  bulkRemove: async (ids: string[]) => {
    const res = await api.post<ApiResponse<{ count: number }>>(
      "/spare-category/bulk-delete",
      { ids }
    );

    return unwrapApiResponse(res);
  },

  bulkImport: async (
    rows: CreateSpareCategoryBody[]
  ): Promise<BulkImportResult> => {
    const res = await api.post<ApiResponse<BulkImportResult>>(
      "/spare-category/bulk-import",
      { rows }
    );

    return unwrapApiResponse(res);
  },

  export: async (
    query?: ListQuery
  ): Promise<Blob> => {
    const res = await api.get<Blob>(
      "/spare-category/export",
      {
        params: query,
        responseType: "blob",
      }
    );

    return res.data;
  },

  search: async (
    q: string
  ): Promise<SpareCategory[]> => {
    const res = await api.get<ApiResponse<SpareCategory[]>>(
      "/spare-category/search",
      {
        params: { q },
      }
    );

    return unwrapApiResponse(res);
  },
};