import { api } from "@/lib/api";
import type { ApiResponse } from "@skerp/types";
import { unwrapApiResponse } from "@/features/masters/_shared/master-api";

export type RepairCostAmounts = {
  partsPaise: string;
  servicesPaise: string;
  returnsPaise: string;
  netCostPaise: string;
  unbilledServicesPaise: string;
  unpostedCostPaise: string;
};
export type RepairCostRow = RepairCostAmounts & {
  id: string;
  jobCardNumber: string | null;
  vehicleId: string;
  vehicleNumber: string;
  branchName: string;
  outDateTime: string | null;
};
export type RepairCostResult = {
  rows: RepairCostRow[];
  summary: RepairCostAmounts;
  total: number;
  page: number;
  size: number;
};
export const jobCardReportApi = {
  costs: async (
    params: {
      page: number;
      size: number;
      search?: string;
      from?: string;
      to?: string;
    },
    signal?: AbortSignal,
  ) => {
    const response = await api.get<ApiResponse<RepairCostResult>>(
      "/job-card/reports/repair-costs",
      { params, signal },
    );
    return unwrapApiResponse(response);
  },
};
