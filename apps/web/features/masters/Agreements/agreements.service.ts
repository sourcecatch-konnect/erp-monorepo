import { api } from "@/lib/api";
import type {
  ApiResponse,
  Agreement,
  CreateAgreementBody,
  AgreementWithRelations,
  UpdateAgreementBody,
} from "@skerp/types";

import {
  ListQuery,
  ListResult,
  BulkImportResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../_shared/master-api";

export type AgreementListQuery = ListQuery & {
  companyId?: string;
  clientId?: string;
  cityId?: string;
  branchId?: string;
};
type AgreementCompanyListResponse = {
  success: boolean;
  data?: AgreementWithRelations[];
  meta?: {
    page: number;
    size: number;
    total: number;
    pageCount: number;
  };
  error?: {
    message?: string;
  };
};
export const agreementApi = {
  list: async (query?: AgreementListQuery): Promise<ListResult<Agreement>> => {
    const res = await api.get<ApiResponse<Agreement[]>>("/agreements", {
      params: query,
    });

    return unwrapListResponse(res);
  },

listByCompany: async (
  companyId: string,
  query?: ListQuery
): Promise<ListResult<AgreementWithRelations>> => {
  const res = await api.get<AgreementCompanyListResponse>(
    `/agreements/company/${companyId}`,
    {
      params: query,
    }
  );

  const payload = res.data;

  if (!payload.success) {
    throw new Error(
      payload.error?.message ?? "Failed to load company agreements"
    );
  }

  return {
    data: payload.data ?? [],
    meta: payload.meta ?? {
      page: query?.page ?? 0,
      size: query?.size ?? 10,
      total: payload.data?.length ?? 0,
      pageCount: 1,
    },
  };
},

  detail: async (id: string): Promise<Agreement> => {
    const res = await api.get<ApiResponse<Agreement>>(`/agreements/${id}`);

    return unwrapApiResponse(res);
  },

  create: async (body: CreateAgreementBody): Promise<Agreement> => {
    const res = await api.post<ApiResponse<Agreement>>("/agreements", body);

    return unwrapApiResponse(res);
  },

  update: async (
    id: string,
    body: UpdateAgreementBody
  ): Promise<Agreement> => {
    const res = await api.patch<ApiResponse<Agreement>>(
      `/agreements/${id}`,
      body
    );

    return unwrapApiResponse(res);
  },

  remove: async (id: string): Promise<void> => {
    const res = await api.delete<ApiResponse<null>>(`/agreements/${id}`);

    unwrapApiResponse(res);
  },

  bulkRemove: async (ids: string[]) => {
    const res = await api.post<ApiResponse<{ count: number }>>(
      "/agreements/bulk-delete",
      { ids }
    );

    return unwrapApiResponse(res);
  },

  bulkImport: async (
    rows: CreateAgreementBody[]
  ): Promise<BulkImportResult> => {
    const res = await api.post<ApiResponse<BulkImportResult>>(
      "/agreements/bulk-import",
      { rows }
    );

    return unwrapApiResponse(res);
  },

  export: async (query?: AgreementListQuery): Promise<Blob> => {
    const res = await api.get<Blob>("/agreements/export", {
      params: query,
      responseType: "blob",
    });

    return res.data;
  },

  search: async (q: string): Promise<Agreement[]> => {
    const res = await api.get<ApiResponse<Agreement[]>>("/agreements/search", {
      params: { q },
    });

    return unwrapApiResponse(res);
  },
};