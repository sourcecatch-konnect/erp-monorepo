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

  lookup: async (query?: {
    search?: string;
    page?: number;
    size?: number;
  }): Promise<ListResult<Driver>> => {
    const params: Record<string, string | number> = {
      page: query?.page ?? 0,
      size: query?.size ?? 20,
    };

    if (query?.search) params.search = query.search;

    const res = await api.get<ApiResponse<Driver[]>>("/drivers/lookup", {
      params,
    });

    return unwrapListResponse(res);
  },
  getPhotoUploadUrl: async (body: {
    fileName: string;
    contentType: string;
    fileSize: number;
  }): Promise<{ key: string; uploadUrl: string }> => {
    const res = await api.post<ApiResponse<{ key: string; uploadUrl: string }>>(
      "/drivers/_photo/upload-url",
      body,
    );

    return unwrapApiResponse(res);
  },

  getPhotoViewUrl: async (key: string): Promise<{ viewUrl: string }> => {
    const res = await api.get<ApiResponse<{ viewUrl: string }>>(
      "/drivers/_photo/view-url",
      {
        params: { key },
      },
    );

    return unwrapApiResponse(res);
  },

};
