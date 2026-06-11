import { api } from "@/lib/api";
import type {
  ApiResponse,
  Area,
  CreateAreaBody,
  UpdateAreaBody,

} from "@skerp/types";

import {
  ListQuery,
  ListResult,
  BulkImportResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../_shared/master-api";

export const areaApi = {
  list: async (query?: ListQuery): Promise<ListResult<Area>> => {
    const res = await api.get<ApiResponse<Area[]>>("/areas", {
      params: query,
    });
    console.log(res)
    return unwrapListResponse(res);
  },

  detail: async (id: string): Promise<Area> => {
    const res = await api.get<ApiResponse<Area>>(`/areas/${id}`);

    return unwrapApiResponse(res);
  },

  create: async (body: CreateAreaBody): Promise<Area> => {
    const res = await api.post<ApiResponse<Area>>(
      "/areas",
      body
    );

    return unwrapApiResponse(res);
  },

  update: async (
    id: string,
    body: UpdateAreaBody
  ): Promise<Area> => {
    const res = await api.patch<ApiResponse<Area>>(
      `/areas/${id}`,
      body
    );

    return unwrapApiResponse(res);
  },

  remove: async (id: string): Promise<void> => {
    const res = await api.delete<ApiResponse<null>>(
      `/areas/${id}`
    );

    unwrapApiResponse(res);
  },

  bulkRemove: async (ids: string[]) => {
    const res = await api.post<
      ApiResponse<{ count: number }>
    >("/areas/bulk-delete", {
      ids,
    });

    return unwrapApiResponse(res);
  },

  bulkImport: async (
    rows: CreateAreaBody[]
  ): Promise<BulkImportResult> => {
    const res = await api.post<
      ApiResponse<BulkImportResult>
    >("/areas/bulk-import", {
      rows,
    });

    return unwrapApiResponse(res);
  },

  export: async (
    query?: ListQuery
  ): Promise<Blob> => {
    const res = await api.get<Blob>(
      "/areas/export",
      {
        params: query,
        responseType: "blob",
      }
    );

    return res.data;
  },

  search: async (q: string): Promise<Area[]> => {
    const res = await api.get<ApiResponse<Area[]>>(
      "/areas/search",
      {
        params: { q },
      }
    );

    return unwrapApiResponse(res);
  },
};