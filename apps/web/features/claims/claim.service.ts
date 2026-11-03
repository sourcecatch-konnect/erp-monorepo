import { api } from "@/lib/api";
import type { ApiResponse, ClaimListRow } from "@skerp/types";
import { unwrapListResponse, type ListResult } from "@/features/masters/_shared/master-api";

export type ClaimListParams = {
  page: number;
  size: number;
};

export const claimApi = {
  list: async (params: ClaimListParams): Promise<ListResult<ClaimListRow>> => {
    const res = await api.get<ApiResponse<ClaimListRow[]>>("/claims", { params });
    return unwrapListResponse(res);
  },
};
