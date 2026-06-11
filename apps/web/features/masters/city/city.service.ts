import { api } from "@/lib/api";
import type {
  ApiResponse,
  City,
  CreateCityBody,
  UpdateCityBody,
} from "@skerp/types";
import {
  ListQuery,
  ListResult,
  BulkImportResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../_shared/master-api";

export const cityApi = {
  list: async (query?: ListQuery): Promise<ListResult<City>> => {
    const res = await api.get<ApiResponse<City[]>>("/cities", {
      params: query,
    });

    return unwrapListResponse(res);
  },

  detail: async (id: string): Promise<City> => {
    const res = await api.get<ApiResponse<City>>(`/cities/${id}`);

    return unwrapApiResponse(res);
  },

  create: async (body: CreateCityBody): Promise<City> => {
    const res = await api.post<ApiResponse<City>>("/cities", body);

    return unwrapApiResponse(res);
  },

  update: async (
    id: string,
    body: UpdateCityBody
  ): Promise<City> => {
    const res = await api.patch<ApiResponse<City>>(`/cities/${id}`, body);

    return unwrapApiResponse(res);
  },

  remove: async (id: string): Promise<void> => {
    const res = await api.delete<ApiResponse<null>>(`/cities/${id}`);

    unwrapApiResponse(res);
  },

  bulkRemove: async (ids: string[]) => {
    const res = await api.post<ApiResponse<{ count: number }>>(
      "/cities/bulk-delete",
      { ids }
    );

    return unwrapApiResponse(res);
  },

  bulkImport: async (rows: CreateCityBody[]): Promise<BulkImportResult> => {
    const res = await api.post<ApiResponse<BulkImportResult>>(
      "/cities/bulk-import",
      { rows }
    );

    return unwrapApiResponse(res);
  },

  export: async (query?: ListQuery): Promise<Blob> => {
    const res = await api.get<Blob>("/cities/export", {
      params: query,
      responseType: "blob",
    });

    return res.data;
  },

  search: async (q: string): Promise<City[]> => {
    const res = await api.get<ApiResponse<City[]>>("/cities/search", {
      params: { q },
    });

    return unwrapApiResponse(res);
  },
};
