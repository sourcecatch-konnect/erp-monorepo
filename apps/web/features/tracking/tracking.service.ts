import { api } from "@/lib/api";
import type { ApiResponse, FleetVehicle, TrailPoint } from "@skerp/types";

import { unwrapApiResponse } from "../masters/_shared/master-api";

export const trackingApi = {
  /** Live fleet: every Onelap device joined with its latest position. */
  fleet: async (): Promise<FleetVehicle[]> => {
    const res = await api.get<ApiResponse<FleetVehicle[]>>("/tracking/fleet");
    return unwrapApiResponse(res);
  },

  /** Breadcrumb trail for one wagon between two ISO timestamps. */
  history: async (
    assignmentId: string,
    from: string,
    to: string,
  ): Promise<TrailPoint[]> => {
    const res = await api.get<ApiResponse<TrailPoint[]>>("/tracking/history", {
      params: { assignmentId, from, to },
    });
    return unwrapApiResponse(res);
  },
};
