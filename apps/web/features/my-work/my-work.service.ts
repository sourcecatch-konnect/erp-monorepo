import { api } from "@/lib/api";
import type {
  ApiResponse,
  MyWorkQueueKey,
  MyWorkResponse,
  MyWorkRowsResponse,
  MyWorkScope,
} from "@skerp/types";
import { unwrapApiResponse } from "../masters/_shared/master-api";

export const myWorkApi = {
  overview: async (): Promise<MyWorkResponse> => {
    const res = await api.get<ApiResponse<MyWorkResponse>>("/my-work");
    return unwrapApiResponse(res);
  },

  rows: async (
    queue: MyWorkQueueKey,
    scope: MyWorkScope,
    skip: number,
  ): Promise<MyWorkRowsResponse> => {
    const res = await api.get<ApiResponse<MyWorkRowsResponse>>(
      `/my-work/${queue}`,
      { params: { scope, skip } },
    );
    return unwrapApiResponse(res);
  },
};
