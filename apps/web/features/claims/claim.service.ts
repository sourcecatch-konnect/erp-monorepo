import { api } from "@/lib/api";
import type {
  ApiResponse,
  ClaimCause,
  ClaimDetail,
  ClaimListRow,
  ClaimStatus,
  ClaimStatusSummary,
  ClaimType,
} from "@skerp/types";
import {
  unwrapApiResponse,
  unwrapListResponse,
  type ListResult,
} from "@/features/masters/_shared/master-api";

/** Register filters; every one combines with the others on the server. */
export type ClaimFilters = {
  search?: string;
  status?: ClaimStatus;
  claimType?: ClaimType;
  causedBy?: ClaimCause;
  branchId?: string;
  customerId?: string;
  /** All claims on the LRs of one group (LR detail page). */
  lrGroupId?: string;
  /** yyyy-mm-dd */
  dateFrom?: string;
  /** yyyy-mm-dd, inclusive */
  dateTo?: string;
};

export type ClaimListParams = ClaimFilters & {
  page: number;
  size: number;
  /** "field:asc" | "field:desc" */
  sort?: string;
};

export const claimApi = {
  list: async (params: ClaimListParams): Promise<ListResult<ClaimListRow>> => {
    const res = await api.get<ApiResponse<ClaimListRow[]>>("/claims", { params });
    return unwrapListResponse(res);
  },

  summary: async (filters: ClaimFilters): Promise<ClaimStatusSummary[]> => {
    const res = await api.get<ApiResponse<ClaimStatusSummary[]>>("/claims/summary", {
      params: filters,
    });
    return unwrapApiResponse(res);
  },

  get: async (id: string): Promise<ClaimDetail> => {
    const res = await api.get<ApiResponse<ClaimDetail>>(`/claims/${id}`);
    return unwrapApiResponse(res);
  },
};
