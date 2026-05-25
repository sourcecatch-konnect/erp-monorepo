import { api } from "@/lib/api";
import type {
  ApiResponse,
  Driver,
  CreateDriverBody,
  UpdateDriverBody,
} from "@skerp/types";
import {
  ListQuery,
  ListResult,
  BulkImportResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../_shared/master-api";

export const driverApi = {
  list: async (query?: ListQuery): Promise<ListResult<Driver>> => {
    const res = await api.get<ApiResponse<Driver[]>>("/drivers", {
      params: query,
    });

    return unwrapListResponse(res);
  },

  detail: async (id: string): Promise<Driver> => {
    const res = await api.get<ApiResponse<Driver>>(`/drivers/${id}`);

    return unwrapApiResponse(res);
  },

  create: async (body: CreateDriverBody): Promise<Driver> => {
    const res = await api.post<ApiResponse<Driver>>("/drivers", body);

    return unwrapApiResponse(res);
  },

  update: async (
    id: string,
    body: UpdateDriverBody
  ): Promise<Driver> => {
    const res = await api.patch<ApiResponse<Driver>>(`/drivers/${id}`, body);

    return unwrapApiResponse(res);
  },

  remove: async (id: string): Promise<void> => {
    const res = await api.delete<ApiResponse<null>>(`/drivers/${id}`);

    unwrapApiResponse(res);
  },

  bulkRemove: async (ids: string[]) => {
    const res = await api.post<ApiResponse<{ count: number }>>(
      "/drivers/bulk-delete",
      { ids }
    );

    return unwrapApiResponse(res);
  },

  bulkImport: async (
    rows: CreateDriverBody[]
  ): Promise<BulkImportResult> => {
    const res = await api.post<ApiResponse<BulkImportResult>>(
      "/drivers/bulk-import",
      { rows }
    );

    return unwrapApiResponse(res);
  },

  export: async (query?: ListQuery): Promise<Blob> => {
    const res = await api.get<Blob>("/drivers/export", {
      params: query,
      responseType: "blob",
    });

    return res.data;
  },

  search: async (q: string): Promise<Driver[]> => {
    const res = await api.get<ApiResponse<Driver[]>>("/drivers/search", {
      params: { q },
    });

    return unwrapApiResponse(res);
  },
};
