import { api } from "@/lib/api";

import type {
  ApiResponse,
  GRN,
  CreateGRNBody,
  UpdateGRNBody,
  SubmitGRNBody,
  CancelGRNBody,
} from "@skerp/types";

import {
  ListQuery,
  ListResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../masters/_shared/master-api";

export type GRNDetail = GRN & {
  createdBy?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
  } | null;

  updatedBy?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
};

export type GRNLRPreview = {
  lorryReceipt: {
    id: string;
    lrNumber: string;
    status: string;
    invoiceNumber?: string | null;
    invoiceAmount?: number | string | null;
  };

  group: {
    id: string;
    groupNumber: string;
    transportType: string;
    originBranch?: unknown;
    destinationBranch?: unknown;
    consignor?: unknown;
    consignee?: unknown;
  } | null;

  goods: {
    lrGoodsId: string;
    goodsName: string;
    description?: string | null;
    totalQty: number;
    unit?: string | null;
    weight?: number | string | null;
  }[];

  ewayBill?: unknown;
};

const encodeGRNIdentifier = (identifier: string) =>
  encodeURIComponent(identifier);

export const grnApi = {
  list: async (query?: ListQuery): Promise<ListResult<GRN>> => {
    const params: Record<string, string | number> = {};

    if (query?.page !== undefined) params.page = query.page;
    if (query?.size !== undefined) params.size = query.size;
    if (query?.search) params.search = query.search;
    if (query?.sort) params.sort = query.sort;

    if (query?.filter?.status) {
      params["filter[status]"] = String(query.filter.status);
    }

    if (query?.filter?.vpScheduleId) {
      params["filter[vpScheduleId]"] = String(query.filter.vpScheduleId);
    }

    const res = await api.get<ApiResponse<GRN[]>>("/grn", {
      params,
    });

    return unwrapListResponse(res);
  },

  statusCounts: async (): Promise<Record<string, number>> => {
    const res = await api.get<ApiResponse<Record<string, number>>>(
      "/grn/status-counts",
    );

    return unwrapApiResponse(res);
  },

  previewLR: async (
    lorryReceiptId: string,
  ): Promise<GRNLRPreview> => {
    const res = await api.get<ApiResponse<GRNLRPreview>>(
      `/grn/preview/lr/${encodeGRNIdentifier(lorryReceiptId)}`,
    );

    return unwrapApiResponse(res);
  },

  detail: async (identifier: string): Promise<GRNDetail> => {
    const res = await api.get<ApiResponse<GRNDetail>>(
      `/grn/${encodeGRNIdentifier(identifier)}`,
    );

    return unwrapApiResponse(res);
  },

  create: async (body: CreateGRNBody): Promise<GRNDetail> => {
    const res = await api.post<ApiResponse<GRNDetail>>(
      "/grn",
      body,
    );

    return unwrapApiResponse(res);
  },

  update: async (
    identifier: string,
    body: UpdateGRNBody & { version?: number },
  ): Promise<GRNDetail> => {
    const res = await api.patch<ApiResponse<GRNDetail>>(
      `/grn/${encodeGRNIdentifier(identifier)}`,
      body,
    );

    return unwrapApiResponse(res);
  },

  submit: async (
    identifier: string,
    body: SubmitGRNBody,
  ): Promise<GRNDetail> => {
    const res = await api.post<ApiResponse<GRNDetail>>(
      `/grn/${encodeGRNIdentifier(identifier)}/submit`,
      body,
    );

    return unwrapApiResponse(res);
  },

  cancel: async (
    identifier: string,
    body: CancelGRNBody,
  ): Promise<GRNDetail> => {
    const res = await api.post<ApiResponse<GRNDetail>>(
      `/grn/${encodeGRNIdentifier(identifier)}/cancel`,
      body,
    );

    return unwrapApiResponse(res);
  },

  delete: async (identifier: string): Promise<GRNDetail> => {
    const res = await api.delete<ApiResponse<GRNDetail>>(
      `/grn/${encodeGRNIdentifier(identifier)}`,
    );

    return unwrapApiResponse(res);
  },
};