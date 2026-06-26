import { api } from "@/lib/api";
import type {
  ApiResponse,
  RailwayFreightMatrix,
  RailwayFreightMatrixWithRelations,
  CreateRailwayFreightMatrixBody,
  UpdateRailwayFreightMatrixBody,
} from "@skerp/types";

import {
  ListQuery,
  ListResult,
  BulkImportResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../_shared/master-api";

export const railwayFreightApi = {
  list: async (
    query?: ListQuery
  ): Promise<ListResult<RailwayFreightMatrixWithRelations>> => {
    const res = await api.get<ApiResponse<RailwayFreightMatrixWithRelations[]>>(
      "/railway-freight",
      { params: query }
    );

    return unwrapListResponse(res);
  },

  detail: async (id: string): Promise<RailwayFreightMatrixWithRelations> => {
    const res = await api.get<ApiResponse<RailwayFreightMatrixWithRelations>>(
      `/railway-freight/${id}`
    );

    return unwrapApiResponse(res);
  },

  create: async (
    body: CreateRailwayFreightMatrixBody
  ): Promise<RailwayFreightMatrix> => {
    const res = await api.post<ApiResponse<RailwayFreightMatrix>>(
      "/railway-freight",
      body
    );

    return unwrapApiResponse(res);
  },

  update: async (
    id: string,
    body: UpdateRailwayFreightMatrixBody
  ): Promise<RailwayFreightMatrix> => {
    const res = await api.patch<ApiResponse<RailwayFreightMatrix>>(
      `/railway-freight/${id}`,
      body
    );

    return unwrapApiResponse(res);
  },

  remove: async (id: string): Promise<void> => {
    const res = await api.delete<ApiResponse<null>>(
      `/railway-freight/${id}`
    );

    unwrapApiResponse(res);
  },

  bulkRemove: async (ids: string[]) => {
    const res = await api.post<ApiResponse<{ count: number }>>(
      "/railway-freight/bulk-delete",
      { ids }
    );

    return unwrapApiResponse(res);
  },

  bulkImport: async (
    rows: CreateRailwayFreightMatrixBody[]
  ): Promise<BulkImportResult> => {
    const res = await api.post<ApiResponse<BulkImportResult>>(
      "/railway-freight/bulk-import",
      { rows }
    );

    return unwrapApiResponse(res);
  },

  export: async (query?: ListQuery): Promise<Blob> => {
    const res = await api.get<Blob>("/railway-freight/export", {
      params: query,
      responseType: "blob",
    });

    return res.data;
  },

  search: async (q: string): Promise<RailwayFreightMatrixWithRelations[]> => {
    const res = await api.get<ApiResponse<RailwayFreightMatrixWithRelations[]>>(
      "/railway-freight/search",
      { params: { q } }
    );

    return unwrapApiResponse(res);
  },
};
