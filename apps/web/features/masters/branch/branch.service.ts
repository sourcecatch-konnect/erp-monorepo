import { api } from "@/lib/api";
import type {
  ApiResponse,
  Branch,
  CreateBranchBody,
  UpdateBranchBody,
  BranchRailheadArea,
  UpdateBranchRailheadsBody,
} from "@skerp/types";

import { withErrorHandling } from "../_shared/hooks/ApisError";

import {
  ListQuery,
  ListResult,
  BulkImportResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../_shared/master-api";

export const branchApi = {
  list: (query?: ListQuery): Promise<ListResult<Branch>> =>
    withErrorHandling(async () => {
      const res = await api.get<ApiResponse<Branch[]>>("/branches", {
        params: query,
      });

      return unwrapListResponse(res);
    }),

  detail: (id: string): Promise<Branch> =>
    withErrorHandling(async () => {
      const res = await api.get<ApiResponse<Branch>>(`/branches/${id}`);

      return unwrapApiResponse(res);
    }),

  create: (body: CreateBranchBody): Promise<Branch> =>
    withErrorHandling(async () => {
      const res = await api.post<ApiResponse<Branch>>("/branches", body);

      return unwrapApiResponse(res);
    }),

  update: (id: string, body: UpdateBranchBody): Promise<Branch> =>
    withErrorHandling(async () => {
      const res = await api.patch<ApiResponse<Branch>>(`/branches/${id}`, body);

      return unwrapApiResponse(res);
    }),

  remove: (id: string): Promise<void> =>
    withErrorHandling(async () => {
      const res = await api.delete<ApiResponse<null>>(`/branches/${id}`);

      unwrapApiResponse(res);
    }),

  bulkRemove: (ids: string[]) =>
    withErrorHandling(async () => {
      const res = await api.post<ApiResponse<{ count: number }>>(
        "/branches/bulk-delete",
        {
          ids,
        },
      );

      return unwrapApiResponse(res);
    }),

  bulkImport: (rows: CreateBranchBody[]): Promise<BulkImportResult> =>
    withErrorHandling(async () => {
      const res = await api.post<ApiResponse<BulkImportResult>>(
        "/branches/bulk-import",
        {
          rows,
        },
      );

      return unwrapApiResponse(res);
    }),

  export: (query?: ListQuery): Promise<Blob> =>
    withErrorHandling(async () => {
      const res = await api.get<Blob>("/branches/export", {
        params: query,
        responseType: "blob",
      });

      return res.data;
    }),

  search: (q: string): Promise<Branch[]> =>
    withErrorHandling(async () => {
      const res = await api.get<ApiResponse<Branch[]>>("/branches/search", {
        params: { q },
      });

      return unwrapApiResponse(res);
    }),

  railheads: (id: string): Promise<BranchRailheadArea[]> =>
    withErrorHandling(async () => {
      const res = await api.get<ApiResponse<BranchRailheadArea[]>>(
        `/branches/${id}/railheads`,
      );
      return unwrapApiResponse(res);
    }),

  updateRailheads: (
    id: string,
    body: UpdateBranchRailheadsBody,
  ): Promise<BranchRailheadArea[]> =>
    withErrorHandling(async () => {
      const res = await api.put<ApiResponse<BranchRailheadArea[]>>(
        `/branches/${id}/railheads`,
        body,
      );
      return unwrapApiResponse(res);
    }),
};
