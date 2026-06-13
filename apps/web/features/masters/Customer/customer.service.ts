import { api } from "@/lib/api";
import type {
  ApiResponse,
  Customer,
  CreateCustomerBody,
  UpdateCustomerBody,
  
} from "@skerp/types";
import {
  ListQuery,
  ListResult,
  BulkImportResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../_shared/master-api";

export const customerApi = {
  list: async (query?: ListQuery): Promise<ListResult<Customer>> => {
    const res = await api.get<ApiResponse<Customer[]>>("/customers", {
      params: query,
    });

    return unwrapListResponse(res);
  },

  detail: async (id: string): Promise<Customer> => {
    const res = await api.get<ApiResponse<Customer>>(`/customers/${id}`);

    return unwrapApiResponse(res);
  },

  create: async (body: CreateCustomerBody): Promise<Customer> => {
    const res = await api.post<ApiResponse<Customer>>("/customers", body);

    return unwrapApiResponse(res);
  },

  update: async (
    id: string,
    body: UpdateCustomerBody
  ): Promise<Customer> => {
    const res = await api.patch<ApiResponse<Customer>>(
      `/customers/${id}`,
      body
    );

    return unwrapApiResponse(res);
  },

  remove: async (id: string): Promise<void> => {
    const res = await api.delete<ApiResponse<null>>(`/customers/${id}`);

    unwrapApiResponse(res);
  },

  bulkRemove: async (ids: string[]) => {
    const res = await api.post<ApiResponse<{ count: number }>>(
      "/customers/bulk-delete",
      { ids }
    );

    return unwrapApiResponse(res);
  },

  bulkImport: async (
    rows: CreateCustomerBody[]
  ): Promise<BulkImportResult> => {
    const res = await api.post<ApiResponse<BulkImportResult>>(
      "/customers/bulk-import",
      { rows }
    );

    return unwrapApiResponse(res);
  },

  export: async (query?: ListQuery): Promise<Blob> => {
    const res = await api.get<Blob>("/customers/export", {
      params: query,
      responseType: "blob",
    });

    return res.data;
  },

  search: async (q: string): Promise<Customer[]> => {
    const res = await api.get<ApiResponse<Customer[]>>("/customers/search", {
      params: { q },
    });

    return unwrapApiResponse(res);
  },
};