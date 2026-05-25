import { api } from "@/lib/api";
import type {
  ApiResponse,
  Route,
  CreateRouteBody,
  UpdateRouteBody,
} from "@skerp/types";


import {
  ListQuery,
  ListResult,
  BulkImportResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../_shared/master-api";

import { withErrorHandling } from "../_shared/hooks/ApisError";

export const routeApi = {
  list: (query?: ListQuery): Promise<ListResult<Route>> =>
    withErrorHandling(async () => {
      const res = await api.get<ApiResponse<Route[]>>(
        "/routes",
        { params: query }
      );

      return unwrapListResponse(res);
    }),

  detail: (id: string): Promise<Route> =>
    withErrorHandling(async () => {
      const res = await api.get<ApiResponse<Route>>(
        `/routes/${id}`
      );

      return unwrapApiResponse(res);
    }),

  create: (body: CreateRouteBody): Promise<Route> =>
    withErrorHandling(async () => {
      const res = await api.post<ApiResponse<Route>>(
        "/routes",
        body
      );

      return unwrapApiResponse(res);
    }),

  update: (id: string, body: UpdateRouteBody): Promise<Route> =>
    withErrorHandling(async () => {
      const res = await api.patch<ApiResponse<Route>>(
        `/routes/${id}`,
        body
      );

      return unwrapApiResponse(res);
    }),

  remove: (id: string): Promise<void> =>
    withErrorHandling(async () => {
      const res = await api.delete<ApiResponse<null>>(
        `/routes/${id}`
      );

      unwrapApiResponse(res);
    }),

  bulkRemove: (ids: string[]) =>
    withErrorHandling(async () => {
      const res = await api.post<ApiResponse<{ count: number }>>(
        "/routes/bulk-delete",
        { ids }
      );

      return unwrapApiResponse(res);
    }),

  bulkImport: (rows: CreateRouteBody[]) =>
    withErrorHandling(async () => {
      const res = await api.post<ApiResponse<BulkImportResult>>(
        "/routes/bulk-import",
        { rows }
      );

      return unwrapApiResponse(res);
    }),

  export: (query?: ListQuery): Promise<Blob> =>
    withErrorHandling(async () => {
      const res = await api.get<Blob>("/routes/export", {
        params: query,
        responseType: "blob",
      });

      return res.data;
    }),

  search: (q: string): Promise<Route[]> =>
    withErrorHandling(async () => {
      const res = await api.get<ApiResponse<Route[]>>(
        "/routes/search",
        { params: { q } }
      );

      return unwrapApiResponse(res);
    }),
};