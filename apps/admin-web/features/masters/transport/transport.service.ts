import { api } from "@/lib/api";
import type {
  ApiResponse,
  Transport,
  CreateTransportBody,
  UpdateTransportBody,
} from "@skerp/types";
import {
  ListQuery,
  ListResult,
  BulkImportResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../_shared/master-api";

export const transportApi = {
  list: async (query?: ListQuery): Promise<ListResult<Transport>> => {
    const res = await api.get<ApiResponse<Transport[]>>("/transports", {
      params: query,
    });

    return unwrapListResponse(res);
  },

  detail: async (id: string): Promise<Transport> => {
    const res = await api.get<ApiResponse<Transport>>(`/transports/${id}`);

    return unwrapApiResponse(res);
  },

  create: async (body: CreateTransportBody): Promise<Transport> => {
    const res = await api.post<ApiResponse<Transport>>("/transports", body);

    return unwrapApiResponse(res);
  },

  update: async (
    id: string,
    body: UpdateTransportBody
  ): Promise<Transport> => {
    const res = await api.patch<ApiResponse<Transport>>(
      `/transports/${id}`,
      body
    );

    return unwrapApiResponse(res);
  },

  remove: async (id: string): Promise<void> => {
    const res = await api.delete<ApiResponse<null>>(`/transports/${id}`);

    unwrapApiResponse(res);
  },

  bulkRemove: async (ids: string[]) => {
    const res = await api.post<ApiResponse<{ count: number }>>(
      "/transports/bulk-delete",
      { ids }
    );

    return unwrapApiResponse(res);
  },

  bulkImport: async (
    rows: CreateTransportBody[]
  ): Promise<BulkImportResult> => {
    const res = await api.post<ApiResponse<BulkImportResult>>(
      "/transports/bulk-import",
      { rows }
    );

    return unwrapApiResponse(res);
  },

  export: async (query?: ListQuery): Promise<Blob> => {
    const res = await api.get<Blob>("/transports/export", {
      params: query,
      responseType: "blob",
    });

    return res.data;
  },

  search: async (q: string): Promise<Transport[]> => {
    const res = await api.get<ApiResponse<Transport[]>>(
      "/transports/search",
      {
        params: { q },
      }
    );

    return unwrapApiResponse(res);
  },
};