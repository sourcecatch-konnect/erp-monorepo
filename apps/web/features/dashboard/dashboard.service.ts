import { api } from "@/lib/api";
import type {
  ApiResponse,
  DashboardPeriod,
  DashboardResponse,
} from "@skerp/types";
import { unwrapApiResponse } from "../masters/_shared/master-api";

export const dashboardApi = {
  overview: async (
    period: DashboardPeriod,
    branch: string | null,
  ): Promise<DashboardResponse> => {
    const res = await api.get<ApiResponse<DashboardResponse>>("/dashboard", {
      params: { period, branch: branch ?? undefined },
    });
    return unwrapApiResponse(res);
  },
};
