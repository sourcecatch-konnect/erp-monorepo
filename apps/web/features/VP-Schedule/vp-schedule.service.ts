import { api } from "@/lib/api";
import type {
  ApiResponse,
  VPSchedule,
  CreateVPScheduleBody,
  UpdateVPScheduleBody,
  ConfirmVPScheduleBody,
  CancelVPScheduleBody,
  VPScheduleFreightPreview,
  VPScheduleFreightPreviewBody,
} from "@skerp/types";
import {
  ListQuery,
  ListResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../masters/_shared/master-api";
export type VPScheduleDetail = VPSchedule & {
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

const encodeVPScheduleIdentifier = (identifier: string) =>
  encodeURIComponent(identifier);

export const vpScheduleApi = {
  freightPreview: async (
    body: VPScheduleFreightPreviewBody,
  ): Promise<VPScheduleFreightPreview> => {
    const res = await api.post<ApiResponse<VPScheduleFreightPreview>>(
      "/vp-schedules/freight-preview",
      body,
    );

    return unwrapApiResponse(res);
  },

  list: async (query?: ListQuery): Promise<ListResult<VPSchedule>> => {
    const params: Record<string, string | number> = {};

    if (query?.page !== undefined) params.page = query.page;
    if (query?.size !== undefined) params.size = query.size;
    if (query?.search) params.search = query.search;
    if (query?.sort) params.sort = query.sort;

    if (query?.filter?.status) {
      params["filter[status]"] = String(query.filter.status);
    }

    const res = await api.get<ApiResponse<VPSchedule[]>>("/vp-schedules", {
      params,
    });

    return unwrapListResponse(res);
  },

  detail: async (identifier: string): Promise<VPScheduleDetail> => {
    const res = await api.get<ApiResponse<VPScheduleDetail>>(
      `/vp-schedules/${encodeVPScheduleIdentifier(identifier)}`,
    );

    return unwrapApiResponse(res);
  },

  create: async (body: CreateVPScheduleBody): Promise<VPSchedule> => {
    const res = await api.post<ApiResponse<VPSchedule>>(
      "/vp-schedules",
      body,
    );

    return unwrapApiResponse(res);
  },

  update: async (
    identifier: string,
    body: UpdateVPScheduleBody & { version?: number },
  ): Promise<VPSchedule> => {
    const res = await api.patch<ApiResponse<VPSchedule>>(
      `/vp-schedules/${encodeVPScheduleIdentifier(identifier)}`,
      body,
    );

    return unwrapApiResponse(res);
  },

  confirm: async (
    identifier: string,
    body: ConfirmVPScheduleBody,
  ): Promise<VPSchedule> => {
    const res = await api.post<ApiResponse<VPSchedule>>(
      `/vp-schedules/${encodeVPScheduleIdentifier(identifier)}/confirm`,
      body,
    );

    return unwrapApiResponse(res);
  },

  cancel: async (
    identifier: string,
    body: CancelVPScheduleBody,
  ): Promise<VPSchedule> => {
    const res = await api.post<ApiResponse<VPSchedule>>(
      `/vp-schedules/${encodeVPScheduleIdentifier(identifier)}/cancel`,
      body,
    );

    return unwrapApiResponse(res);
  },

  delete: async (identifier: string): Promise<VPSchedule> => {
    const res = await api.delete<ApiResponse<VPSchedule>>(
      `/vp-schedules/${encodeVPScheduleIdentifier(identifier)}`,
    );

    return unwrapApiResponse(res);
  },
};
