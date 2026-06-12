import { api } from "@/lib/api";
import type {
  ApiResponse,
  Warehouse,
  CreateWarehouseBody,
  UpdateWarehouseBody,
} from "@skerp/types";

import {
  ListQuery,
  ListResult,
  BulkImportResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../_shared/master-api";

import { withErrorHandling } from "../_shared/hooks/ApisError";

export const warehouseApi = {
  /* -----------------------------
     LIST
  ------------------------------ */
  list: (query?: ListQuery): Promise<ListResult<Warehouse>> =>
    withErrorHandling(async () => {
      const res = await api.get<ApiResponse<Warehouse[]>>(
        "/warehouses",
        { params: query }
      );

      return unwrapListResponse(res);
    }),

  /* -----------------------------
     DETAIL
  ------------------------------ */
  detail: (id: string): Promise<Warehouse> =>
    withErrorHandling(async () => {
      const res = await api.get<ApiResponse<Warehouse>>(
        `/warehouses/${id}`
      );

      return unwrapApiResponse(res);
    }),

  /* -----------------------------
     CREATE
  ------------------------------ */
  create: (body: CreateWarehouseBody): Promise<Warehouse> =>
    withErrorHandling(async () => {
      const res = await api.post<ApiResponse<Warehouse>>(
        "/warehouses",
        body
      );

      return unwrapApiResponse(res);
    }),

  /* -----------------------------
     UPDATE
  ------------------------------ */
  update: (id: string, body: UpdateWarehouseBody): Promise<Warehouse> =>
    withErrorHandling(async () => {
      const res = await api.patch<ApiResponse<Warehouse>>(
        `/warehouses/${id}`,
        body
      );

      return unwrapApiResponse(res);
    }),

  /* -----------------------------
     DELETE
  ------------------------------ */
  remove: (id: string): Promise<void> =>
    withErrorHandling(async () => {
      const res = await api.delete<ApiResponse<null>>(
        `/warehouses/${id}`
      );

      unwrapApiResponse(res);
    }),

  /* -----------------------------
     BULK DELETE
  ------------------------------ */
  bulkRemove: (ids: string[]) =>
    withErrorHandling(async () => {
      const res = await api.post<ApiResponse<{ count: number }>>(
        "/warehouses/bulk-delete",
        { ids }
      );

      return unwrapApiResponse(res);
    }),

  /* -----------------------------
     BULK IMPORT
  ------------------------------ */
  bulkImport: (rows: CreateWarehouseBody[]) =>
    withErrorHandling(async () => {
      const res = await api.post<ApiResponse<BulkImportResult>>(
        "/warehouses/bulk-import",
        { rows }
      );

      return unwrapApiResponse(res);
    }),

  /* -----------------------------
     EXPORT
  ------------------------------ */
  export: (query?: ListQuery): Promise<Blob> =>
    withErrorHandling(async () => {
      const res = await api.get<Blob>("/warehouses/export", {
        params: query,
        responseType: "blob",
      });

      return res.data;
    }),

  /* -----------------------------
     SEARCH
  ------------------------------ */
  search: (q: string): Promise<Warehouse[]> =>
    withErrorHandling(async () => {
      const res = await api.get<ApiResponse<Warehouse[]>>(
        "/warehouses/search",
        { params: { q } }
      );

      return unwrapApiResponse(res);
    }),
};