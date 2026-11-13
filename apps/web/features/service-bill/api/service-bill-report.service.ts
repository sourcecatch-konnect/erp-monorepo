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
  unbilled: async (
    params: {
      page: number;
      size: number;
      search?: string;
      completedTo?: string;
    },
    signal?: AbortSignal,
  ) => {
    const response = await api.get<ApiResponse<UnbilledReportResult>>(
      "/service-bill/reports/unbilled",
      { params, signal },
    );
    return unwrapApiResponse(response);
  },
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

export type UnbilledReportResult = {
  rows: {
    id: string;
    jobCardId: string;
    jobCardNumber: string | null;
    vehicleNumber: string;
    branchName: string;
    providerName: string;
    serviceProviderId: string;
    sparePartName: string;
    description: string | null;
    completedAt: string | null;
    qty: number;
    amountPaise: string;
  }[];
  total: number;
  page: number;
  size: number;
  summary: { amountPaise: string; jobCards: number; providers: number };
};
