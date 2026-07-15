import { api } from "@/lib/api";
import type {
  ApiResponse,
  CreateUnitOfMeasureBody,
  UnitOfMeasure,
  UpdateUnitOfMeasureBody,
} from "@skerp/types";
import {
  BulkImportResult,
  ListQuery,
  ListResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../_shared/master-api";

export const unitOfMeasureApi = {
  list: async (query?: ListQuery): Promise<ListResult<UnitOfMeasure>> => {
    const res = await api.get<ApiResponse<UnitOfMeasure[]>>(
      "/unit-of-measures",
      { params: query },
    );
    return unwrapListResponse(res);
  },
  detail: async (id: string): Promise<UnitOfMeasure> => {
    const res = await api.get<ApiResponse<UnitOfMeasure>>(
      `/unit-of-measures/${id}`,
    );
    return unwrapApiResponse(res);
  },
  create: async (body: CreateUnitOfMeasureBody): Promise<UnitOfMeasure> => {
    const res = await api.post<ApiResponse<UnitOfMeasure>>(
      "/unit-of-measures",
      body,
    );
    return unwrapApiResponse(res);
  },
  update: async (
    id: string,
    body: UpdateUnitOfMeasureBody,
  ): Promise<UnitOfMeasure> => {
    const res = await api.patch<ApiResponse<UnitOfMeasure>>(
      `/unit-of-measures/${id}`,
      body,
    );
    return unwrapApiResponse(res);
  },
  remove: async (id: string): Promise<void> => {
    const res = await api.delete<ApiResponse<null>>(`/unit-of-measures/${id}`);
    unwrapApiResponse(res);
  },
  bulkRemove: async (ids: string[]) => {
    const res = await api.post<ApiResponse<{ count: number }>>(
      "/unit-of-measures/bulk-delete",
      { ids },
    );
    return unwrapApiResponse(res);
  },
  bulkImport: async (
    rows: CreateUnitOfMeasureBody[],
  ): Promise<BulkImportResult> => {
    const res = await api.post<ApiResponse<BulkImportResult>>(
      "/unit-of-measures/bulk-import",
      { rows },
    );
    return unwrapApiResponse(res);
  },
  export: async (query?: ListQuery): Promise<Blob> => {
    const res = await api.get<Blob>("/unit-of-measures/export", {
      params: query,
      responseType: "blob",
    });
    return res.data;
  },
};
