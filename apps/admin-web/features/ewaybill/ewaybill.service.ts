import { api } from "@/lib/api";
import type { ApiResponse } from "@skerp/types";
import { unwrapApiResponse } from "../masters/_shared/master-api";
import type {
  EwayBill,
  EwbListFilters,
  EwbSummary,
  ExtendBody,
  UpdateVehicleBody,
} from "./types";

export type LiveWbResponse<T = unknown> = {
  status_cd?: string;
  status_desc?: string;
  error?: { code?: string; desc?: string; message?: string };
  data?: T;
  __unconfigured?: true;
};

export const ewbApi = {
  list: async (filters: EwbListFilters = {}): Promise<EwayBill[]> => {
    const res = await api.get<ApiResponse<EwayBill[]>>("/ewaybills", {
      params: filters,
    });
    return unwrapApiResponse(res);
  },

  summary: async (): Promise<EwbSummary> => {
    const res = await api.get<ApiResponse<EwbSummary>>("/ewaybills/summary");
    return unwrapApiResponse(res);
  },

  detail: async (ewbNo: string): Promise<EwayBill> => {
    const res = await api.get<ApiResponse<EwayBill>>(`/ewaybills/${ewbNo}`);
    return unwrapApiResponse(res);
  },

  updateVehicle: async (
    ewbNo: string,
    body: UpdateVehicleBody
  ): Promise<EwayBill> => {
    const res = await api.post<ApiResponse<EwayBill>>(
      `/ewaybills/${ewbNo}/update-vehicle`,
      body
    );
    return unwrapApiResponse(res);
  },

  extend: async (ewbNo: string, body: ExtendBody): Promise<EwayBill> => {
    const res = await api.post<ApiResponse<EwayBill>>(
      `/ewaybills/${ewbNo}/extend`,
      body
    );
    return unwrapApiResponse(res);
  },

  liveStatus: async (): Promise<{
    configured: boolean;
    result?: LiveWbResponse;
  }> => {
    const res = await api.get<
      ApiResponse<{ configured: boolean; result?: LiveWbResponse }>
    >("/ewaybills/live/status");
    return unwrapApiResponse(res);
  },

  liveGstin: async (gstin: string): Promise<LiveWbResponse> => {
    const res = await api.get<ApiResponse<LiveWbResponse>>(
      `/ewaybills/live/gstin/${gstin}`
    );
    return unwrapApiResponse(res);
  },

  liveHsn: async (hsn: string): Promise<LiveWbResponse> => {
    const res = await api.get<ApiResponse<LiveWbResponse>>(
      `/ewaybills/live/hsn/${hsn}`
    );
    return unwrapApiResponse(res);
  },
};
