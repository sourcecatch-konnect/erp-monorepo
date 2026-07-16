import { api } from "@/lib/api";
import type {
  ApiResponse,
  MRRR,
  CreateMRRRBody,
  UpdateMRRRBody,
  UpdateMRRRRowsBody,
  SubmitMRRRBody,
  CancelMRRRBody,
  VPSchedule,
} from "@skerp/types";
import {
  ListQuery,
  ListResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../masters/_shared/master-api";

export type MRRRDetailRow = NonNullable<MRRR["rows"]>[number] & {
  freightAmount?: number | string | null;
  vpScheduleWagonCount?: {
    id: string;
    count: number;
    wagonId: string;
    capacityCft?: number | null;
    capacityMt?: number | null;
    totalCft?: number | null;
    totalMt?: number | null;
    freightAmount?: number | string | null;
    totalFreight?: number | string | null;
  } | null;
};

export type MRRRDetail = Omit<MRRR, "vpSchedule" | "rows"> & {
  vpSchedule?: VPSchedule | null;
  rows?: MRRRDetailRow[];
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

export type MRRRVPScheduleOption = Pick<
  VPSchedule,
  "id" | "scheduleNumber" | "scheduleDate" | "scheduleName" | "totalWagonCount"
> & {
  label: string;
  value: string;
  fromBranch?: {
    id: string;
    name: string;
    branchCode?: string | null;
  } | null;
  toBranch?: {
    id: string;
    name: string;
    branchCode?: string | null;
  } | null;
};

export type MRRRPreviewResponse = {
  vpSchedule: VPSchedule;
  rows: Array<{
    vpScheduleWagonCountId: string;
    wagonId: string;
    wagonTypeLabel: string;
    rowNumber: number;
    rowLabel: string;
  }>;
};

const encodeMRRRIdentifier = (identifier: string) =>
  encodeURIComponent(identifier);

export const mrrrApi = {
  vpSchedules: async (
    query?: ListQuery & { scheduleDate?: string },
  ): Promise<ListResult<MRRRVPScheduleOption>> => {
    const params: Record<string, string | number> = {};

    if (query?.page !== undefined) params.page = query.page;
    if (query?.size !== undefined) params.size = query.size;
    if (query?.search) params.search = query.search;
    if (query?.scheduleDate) params.scheduleDate = query.scheduleDate;

    const res = await api.get<ApiResponse<MRRRVPScheduleOption[]>>(
      "/mrrr/vp-schedules",
      { params },
    );

    if (!res.data.ok) {
      throw new Error(res.data.error.message);
    }

    return {
      data: res.data.data,
      meta: res.data.meta,
    };
  },

  preview: async (vpScheduleId: string): Promise<MRRRPreviewResponse> => {
    const res = await api.get<ApiResponse<MRRRPreviewResponse>>(
      `/mrrr/vp-schedules/${encodeURIComponent(vpScheduleId)}/preview`,
    );

    return unwrapApiResponse(res);
  },

  list: async (query?: ListQuery): Promise<ListResult<MRRR>> => {
    const params: Record<string, string | number> = {};

    if (query?.page !== undefined) params.page = query.page;
    if (query?.size !== undefined) params.size = query.size;
    if (query?.search) params.search = query.search;
    if (query?.sort) params.sort = query.sort;

    if (query?.filter?.status) {
      params.status = String(query.filter.status);
    }

    const res = await api.get<ApiResponse<MRRR[]>>("/mrrr", {
      params,
    });

    return unwrapListResponse(res);
  },

  detail: async (identifier: string): Promise<MRRRDetail> => {
    const res = await api.get<ApiResponse<MRRRDetail>>(
      `/mrrr/${encodeMRRRIdentifier(identifier)}`,
    );

    return unwrapApiResponse(res);
  },

  create: async (body: CreateMRRRBody): Promise<MRRR> => {
    const res = await api.post<ApiResponse<MRRR>>("/mrrr", body);

    return unwrapApiResponse(res);
  },

  update: async (
    identifier: string,
    body: UpdateMRRRBody & { version?: number },
  ): Promise<MRRR> => {
    const res = await api.patch<ApiResponse<MRRR>>(
      `/mrrr/${encodeMRRRIdentifier(identifier)}`,
      body,
    );

    return unwrapApiResponse(res);
  },

  updateRows: async (
    identifier: string,
    body: UpdateMRRRRowsBody,
  ): Promise<MRRR> => {
    const res = await api.patch<ApiResponse<MRRR>>(
      `/mrrr/${encodeMRRRIdentifier(identifier)}/rows`,
      body,
    );

    return unwrapApiResponse(res);
  },

  submit: async (identifier: string, body: SubmitMRRRBody): Promise<MRRR> => {
    const res = await api.post<ApiResponse<MRRR>>(
      `/mrrr/${encodeMRRRIdentifier(identifier)}/submit`,
      body,
    );

    return unwrapApiResponse(res);
  },

  cancel: async (identifier: string, body: CancelMRRRBody): Promise<MRRR> => {
    const res = await api.post<ApiResponse<MRRR>>(
      `/mrrr/${encodeMRRRIdentifier(identifier)}/cancel`,
      body,
    );

    return unwrapApiResponse(res);
  },

  delete: async (identifier: string): Promise<{ id: string }> => {
    const res = await api.delete<ApiResponse<{ id: string }>>(
      `/mrrr/${encodeMRRRIdentifier(identifier)}`,
    );

    return unwrapApiResponse(res);
  },
};
