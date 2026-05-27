import { api } from "@/lib/api";
import type {
  ApiResponse,
  CreateStateBody,
  State,
  UpdateStateBody,
} from "@skerp/types";
import {
  ListQuery,
  ListResult,
  BulkImportResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../_shared/master-api";

export const stateApi = {
  list: async (query?: ListQuery): Promise<ListResult<State>> => {
    const res = await api.get<ApiResponse<State[]>>("/states", {
      params: query,
    });

    return unwrapListResponse(res);
  },

  detail: async (id: string): Promise<State> => {
    const res = await api.get<ApiResponse<State>>(`/states/${id}`);

    return unwrapApiResponse(res);
  },

  create: async (body: CreateStateBody): Promise<State> => {
    const res = await api.post<ApiResponse<State>>("/states", body);

    return unwrapApiResponse(res);
  },

  update: async (
    id: string,
    body: UpdateStateBody
  ): Promise<State> => {
    const res = await api.patch<ApiResponse<State>>(
      `/states/${id}`,
      body
    );

    return unwrapApiResponse(res);
  },

  remove: async (id: string): Promise<void> => {
    const res = await api.delete<ApiResponse<null>>(`/states/${id}`);

    unwrapApiResponse(res);
  },

  bulkRemove: async (ids: string[]) => {
    const res = await api.post<ApiResponse<{ count: number }>>(
      "/states/bulk-delete",
      { ids }
    );

    return unwrapApiResponse(res);
  },

  bulkImport: async (rows: CreateStateBody[]): Promise<BulkImportResult> => {
    const res = await api.post<ApiResponse<BulkImportResult>>(
      "/states/bulk-import",
      { rows }
    );

    return unwrapApiResponse(res);
  },

  export: async (query?: ListQuery): Promise<Blob> => {
    const res = await api.get<Blob>("/states/export", {
      params: query,
      responseType: "blob",
    });

    return res.data;
  },

  search: async (q: string): Promise<State[]> => {
    const res = await api.get<ApiResponse<State[]>>("/states/search", {
      params: { q },
    });

    return unwrapApiResponse(res);
  },
};
