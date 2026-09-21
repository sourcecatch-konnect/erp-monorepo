import { api } from "@/lib/api";
import type { ApiResponse } from "@skerp/types";
import {
  unwrapApiResponse,
  unwrapListResponse,
  type ListResult,
} from "@/features/masters/_shared/master-api";

export type StockLedgerRow = {
  id: string;
  sparePartId: string;
  branchId: string;
  currentQty: number;
  movingAvgCostPaise: string;
  updatedAt: string;
  sparePart: { id: string; name: string; unit: string; minimumStock: number };
  branch: { id: string; name: string; branchCode: string };
};

export type StockListFilters = {
  branchId?: string;
  search?: string;
  page?: number;
  size?: number;
};

export const stockApi = {
  list: async (filters: StockListFilters = {}): Promise<ListResult<StockLedgerRow>> => {
    const res = await api.get<ApiResponse<StockLedgerRow[]>>("/spare-inward/stock", {
      params: filters,
    });
    return unwrapListResponse(res);
  },

  lowCount: async (): Promise<number> => {
    const res = await api.get<ApiResponse<{ count: number }>>("/spare-inward/stock/low-count");
    return unwrapApiResponse(res).count;
  },
};
