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
  audit: async (params: AuditParams, signal?: AbortSignal) => {
    const response = await api.get<ApiResponse<AuditResult>>(
      "/job-card/reports/audit",
      { params, signal },
    );
    return unwrapApiResponse(response);
  },
  reconciliation: async (
    params: {
      page: number;
      size: number;
      search?: string;
      kind?: ReconciliationKind;
      view: "ISSUES" | "ALL";
    },
    signal?: AbortSignal,
  ) => {
    const response = await api.get<ApiResponse<ReconciliationResult>>(
      "/job-card/reports/reconciliation",
      { params, signal },
    );
    return unwrapApiResponse(response);
  },
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

export type AuditParams = {
  mode: "STOCK" | "SETTLEMENTS" | "POSTINGS" | "TALLY";
  view: "ISSUES" | "ALL";
  search?: string;
  from?: string;
  to?: string;
  page: number;
  size: number;
};
export type AuditResult = {
  rows: {
    id: string;
    documentNumber: string;
    branchName: string;
    date: string | null;
    unit: "PAISE" | "QTY";
    expected: string;
    actual: string;
    difference: string;
    issue: string;
    state: string;
    voucherNumber: string | null;
    tallySyncStatus: string | null;
  }[];
  total: number;
  page: number;
  size: number;
  summary: {
    issues: number;
    moneyDifferencePaise: string;
    quantityDifference: string;
    activeExpensePaise: string;
  };
};

export type ReconciliationKind = "PARTS" | "SERVICES" | "RETURN";
export type ReconciliationResult = {
  rows: {
    id: string;
    kind: ReconciliationKind;
    parentId: string;
    documentNumber: string | null;
    sourceDate: string | null;
    branchName: string;
    journalEntryId: string | null;
    voucherNumber: string | null;
    tallySyncStatus: string | null;
    expectedPaise: string;
    recordedPaise: string;
    differencePaise: string;
    issue: string;
  }[];
  total: number;
  page: number;
  size: number;
  summary: {
    issues: number;
    expectedPaise: string;
    recordedPaise: string;
    absoluteDifferencePaise: string;
  };
};
