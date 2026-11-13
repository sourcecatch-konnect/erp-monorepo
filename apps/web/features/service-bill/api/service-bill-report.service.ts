import type { ApiResponse } from "@skerp/types";
import { api } from "@/lib/api";
import { unwrapApiResponse } from "@/features/masters/_shared/master-api";

export type AgeBucket = "FUTURE" | "0_30" | "31_60" | "61_90" | "90_PLUS";
export const ageBucketLabels: Record<AgeBucket, string> = {
  FUTURE: "Future dated",
  "0_30": "0–30 days",
  "31_60": "31–60 days",
  "61_90": "61–90 days",
  "90_PLUS": "Over 90 days",
};
export type OutstandingResult = {
  rows: {
    id: string;
    serviceBillNumber: string | null;
    providerInvoiceNo: string;
    billDate: string;
    providerName: string;
    shopName: string | null;
    branchName: string;
    netAmountPaise: string;
    settledPaise: string;
    outstandingPaise: string;
    ageDays: number;
    bucket: AgeBucket;
  }[];
  summary: {
    outstandingPaise: string;
    futurePaise: string;
    days0To30Paise: string;
    days31To60Paise: string;
    days61To90Paise: string;
    daysOver90Paise: string;
  };
  total: number;
  reportDate: string;
  page: number;
  size: number;
};
export const serviceBillReportApi = {
  outstanding: async (
    params: { page: number; size: number; search?: string; bucket?: AgeBucket },
    signal?: AbortSignal,
  ) => {
    const response = await api.get<ApiResponse<OutstandingResult>>(
      "/service-bill/reports/outstanding",
      { params, signal },
    );
    return unwrapApiResponse(response);
  },
};
