import { api } from "@/lib/api";
import type {
  ApiResponse,
  Company,
  CreateCompanyBody,
  UpdateCompanyBody,
} from "@skerp/types";
import {
  ListQuery,
  ListResult,
  BulkImportResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../_shared/master-api";

export const companyApi = {
  list: async (query?: ListQuery): Promise<ListResult<Company>> => {
    const res = await api.get<ApiResponse<Company[]>>("/companies", {
      params: query,
    });
    console.log(res)
    return unwrapListResponse(res);
  },

  detail: async (id: string): Promise<Company> => {
    const res = await api.get<ApiResponse<Company>>(`/companies/${id}`);

    return unwrapApiResponse(res);
  },

  create: async (body: CreateCompanyBody): Promise<Company> => {
    const res = await api.post<ApiResponse<Company>>("/companies", body);

    return unwrapApiResponse(res);
  },

  update: async (
    id: string,
    body: UpdateCompanyBody
  ): Promise<Company> => {
    const res = await api.patch<ApiResponse<Company>>(`/companies/${id}`, body);

    return unwrapApiResponse(res);
  },

  remove: async (id: string): Promise<void> => {
    const res = await api.delete<ApiResponse<null>>(`/companies/${id}`);

    unwrapApiResponse(res);
  },

  bulkRemove: async (ids: string[]) => {
    const res = await api.post<ApiResponse<{ count: number }>>(
      "/companies/bulk-delete",
      { ids }
    );

    return unwrapApiResponse(res);
  },

  bulkImport: async (
    rows: CreateCompanyBody[]
  ): Promise<BulkImportResult> => {
    const res = await api.post<ApiResponse<BulkImportResult>>(
      "/companies/bulk-import",
      { rows }
    );

    return unwrapApiResponse(res);
  },

  export: async (query?: ListQuery): Promise<Blob> => {
    const res = await api.get<Blob>("/companies/export", {
      params: query,
      responseType: "blob",
    });

    return res.data;
  },

  search: async (q: string): Promise<Company[]> => {
    const res = await api.get<ApiResponse<Company[]>>("/companies/search", {
      params: { q },
    });

    return unwrapApiResponse(res);
  },
};