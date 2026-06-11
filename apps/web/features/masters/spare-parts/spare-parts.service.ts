import { api } from "@/lib/api";
import type {
  ApiResponse,
  SparePart,
  CreateSparePartBody,
  UpdateSparePartBody,
} from "@skerp/types";
import {
  ListQuery,
  ListResult,
  BulkImportResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../_shared/master-api";

export const sparePartApi = {
  list: async (query?: ListQuery): Promise<ListResult<SparePart>> => {
    const res = await api.get<ApiResponse<SparePart[]>>("/spare-parts", {
      params: query,
    });

    return unwrapListResponse(res);
  },

  detail: async (id: string): Promise<SparePart> => {
    const res = await api.get<ApiResponse<SparePart>>(`/spare-parts/${id}`);

    return unwrapApiResponse(res);
  },

  create: async (body: CreateSparePartBody): Promise<SparePart> => {
    const res = await api.post<ApiResponse<SparePart>>("/spare-parts", body);

    return unwrapApiResponse(res);
  },

  update: async (
    id: string,
    body: UpdateSparePartBody
  ): Promise<SparePart> => {
    const res = await api.patch<ApiResponse<SparePart>>(
      `/spare-parts/${id}`,
      body
    );

    return unwrapApiResponse(res);
  },

  remove: async (id: string): Promise<void> => {
    const res = await api.delete<ApiResponse<null>>(`/spare-parts/${id}`);

    unwrapApiResponse(res);
  },

  bulkRemove: async (ids: string[]) => {
    const res = await api.post<ApiResponse<{ count: number }>>(
      "/spare-parts/bulk-delete",
      { ids }
    );

    return unwrapApiResponse(res);
  },

  bulkImport: async (
    rows: CreateSparePartBody[]
  ): Promise<BulkImportResult> => {
    const res = await api.post<ApiResponse<BulkImportResult>>(
      "/spare-parts/bulk-import",
      { rows }
    );

    return unwrapApiResponse(res);
  },

  export: async (query?: ListQuery): Promise<Blob> => {
    const res = await api.get<Blob>("/spare-parts/export", {
      params: query,
      responseType: "blob",
    });

    return res.data;
  },

  search: async (q: string): Promise<SparePart[]> => {
    const res = await api.get<ApiResponse<SparePart[]>>(
      "/spare-parts/search",
      {
        params: { q },
      }
    );

    return unwrapApiResponse(res);
  },
};