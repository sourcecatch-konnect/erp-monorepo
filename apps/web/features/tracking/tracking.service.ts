import { api } from "@/lib/api";
import type { ApiResponse, FleetVehicle } from "@skerp/types";

import { unwrapApiResponse } from "../masters/_shared/master-api";

export const trackingApi = {
  /** Live fleet: every Onelap device joined with its latest position. */
  fleet: async (): Promise<FleetVehicle[]> => {
    const res = await api.get<ApiResponse<FleetVehicle[]>>("/tracking/fleet");
    return unwrapApiResponse(res);
  },
};
