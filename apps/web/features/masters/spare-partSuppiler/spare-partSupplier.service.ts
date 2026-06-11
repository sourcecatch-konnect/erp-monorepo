import { api } from "@/lib/api";
import type {
  ApiResponse,
  SparePartSupplier,
  CreateSparePartSupplierBody,
  UpdateSparePartSupplierBody,
} from "@skerp/types";
import {
  ListQuery,
  ListResult,
  BulkImportResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../_shared/master-api";

export const sparePartSupplierApi = {
  list: async (
    query?: ListQuery
  ): Promise<ListResult<SparePartSupplier>> => {
    const res = await api.get<ApiResponse<SparePartSupplier[]>>(
      "/spare-part-suppliers",
      {
        params: query,
      }
    );

    return unwrapListResponse(res);
  },

  detail: async (id: string): Promise<SparePartSupplier> => {
    const res = await api.get<ApiResponse<SparePartSupplier>>(
      `/spare-part-suppliers/${id}`
    );

    return unwrapApiResponse(res);
  },

  create: async (
    body: CreateSparePartSupplierBody
  ): Promise<SparePartSupplier> => {
    const res = await api.post<ApiResponse<SparePartSupplier>>(
      "/spare-part-suppliers",
      body
    );

    return unwrapApiResponse(res);
  },

  update: async (
    id: string,
    body: UpdateSparePartSupplierBody
  ): Promise<SparePartSupplier> => {
    const res = await api.patch<ApiResponse<SparePartSupplier>>(
      `/spare-part-suppliers/${id}`,
      body
    );

    return unwrapApiResponse(res);
  },

  remove: async (id: string): Promise<void> => {
    const res = await api.delete<ApiResponse<null>>(
      `/spare-part-suppliers/${id}`
    );

    unwrapApiResponse(res);
  },

  bulkRemove: async (ids: string[]) => {
    const res = await api.post<ApiResponse<{ count: number }>>(
      "/spare-part-suppliers/bulk-delete",
      { ids }
    );

    return unwrapApiResponse(res);
  },

  bulkImport: async (
    rows: CreateSparePartSupplierBody[]
  ): Promise<BulkImportResult> => {
    const res = await api.post<ApiResponse<BulkImportResult>>(
      "/spare-part-suppliers/bulk-import",
      { rows }
    );

    return unwrapApiResponse(res);
  },

  export: async (query?: ListQuery): Promise<Blob> => {
    const res = await api.get<Blob>("/spare-part-suppliers/export", {
      params: query,
      responseType: "blob",
    });

    return res.data;
  },

  search: async (q: string): Promise<SparePartSupplier[]> => {
    const res = await api.get<ApiResponse<SparePartSupplier[]>>(
      "/spare-part-suppliers/search",
      {
        params: { q },
      }
    );

    return unwrapApiResponse(res);
  },
};