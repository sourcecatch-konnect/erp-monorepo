import type {
  ApiResponse,
  CalculateRailRakeOperationBody,
  CreateRailRakeOperationBody,
  RailRakeOperationCalculation,
  RailRakeOperationRakeOption,
  RailRakeOperationStage,
  RailRakeOperationStatus,
  UpdateRailRakeOperationBody,
} from "@skerp/types";

import {
  type ListQuery,
  type ListResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "@/features/masters/_shared/master-api";
import { api } from "@/lib/api";

type MoneyValue = string | number;

export type RailRakeOperationPlacement = {
  id: string;
  sequence: number;
  placedAt: string;
  removedAt?: string | null;
  actualMinutes?: number | null;
  freeMinutes?: number | null;
  chargeableMinutes?: number | null;
  remarks?: string | null;
};

export type RailRakeOperationWaiver = {
  id: string;
  sequence: number;
  status: "REQUESTED" | "APPROVED" | "REJECTED" | "RECEIVED" | "CANCELLED";
  letterGivenAt?: string | null;
  letterApprovedAt?: string | null;
  letterReceivedAt?: string | null;
  waiverPercentage?: MoneyValue | null;
  requestedAmount?: MoneyValue | null;
  approvedAmount?: MoneyValue | null;
  referenceNumber?: string | null;
  remarks?: string | null;
};

export type RailRakeOperationPayment = {
  id: string;
  kind: "CHARGE_PAYMENT" | "WAIVER_RECEIPT";
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  amount: MoneyValue;
  paymentBy: "COMPANY" | "CUSTOMER" | "RAILWAY" | "TRANSPORTER" | "OTHER";
  paymentMode: "CASH" | "BANK" | "UPI" | "CHEQUE";
  paymentAt: string;
  referenceNumber?: string | null;
  remarks?: string | null;
};

export type RailRakeOperationCharge = {
  id: string;
  type: "DEMURRAGE" | "WHARFAGE";
  status: string;
  actualMinutes?: number | null;
  freeMinutes?: number | null;
  chargeableMinutes?: number | null;
  ratePerHour?: MoneyValue | null;
  grossAmount: MoneyValue;
  approvedWaiverAmount: MoneyValue;
  netPayableAmount: MoneyValue;
  paidAmount: MoneyValue;
  balanceAmount: MoneyValue;
  chargeLetterDate?: string | null;
  paymentBy?: string | null;
  remarks?: string | null;
  waivers: RailRakeOperationWaiver[];
  payments: RailRakeOperationPayment[];
};

export type RailRakeOperationDetail = {
  id: string;
  railRakeId: string;
  stage: RailRakeOperationStage;
  status: RailRakeOperationStatus;
  arrivalAt?: string | null;
  departureAt?: string | null;
  remarks?: string | null;
  version: number;
  createdAt: string;
  submittedAt?: string | null;
  branch: { id: string; name: string; branchCode: string };
  area: { id: string; name: string; formattedAddress?: string | null };
  railRake: {
    id: string;
    rakeNumber: string;
    status: string;
    fromBranch: { id: string; name: string; branchCode: string };
    toBranch: { id: string; name: string; branchCode: string };
    vpSchedule: {
      scheduleNumber: string;
      scheduleDate: string;
      sourceArea: {
        id: string;
        name: string;
        formattedAddress?: string | null;
      };
      destinationArea: {
        id: string;
        name: string;
        formattedAddress?: string | null;
      };
    };
  };
  placements: RailRakeOperationPlacement[];
  charges: RailRakeOperationCharge[];
};

export const railRakeOperationApi = {
  list: async (
    query: ListQuery,
  ): Promise<ListResult<RailRakeOperationDetail>> => {
    const params: Record<string, string | number> = {
      page: query.page ?? 0,
      size: query.size ?? 10,
    };
    if (query.search) params.search = query.search;
    if (query.filter?.stage)
      params["filter[stage]"] = String(query.filter.stage);
    if (query.filter?.status) {
      params["filter[status]"] = String(query.filter.status);
    }
    const response = await api.get<ApiResponse<RailRakeOperationDetail[]>>(
      "/rail-rake-operations",
      { params },
    );
    return unwrapListResponse(response);
  },

  rakes: async (stage: RailRakeOperationStage) => {
    const response = await api.get<ApiResponse<RailRakeOperationRakeOption[]>>(
      "/rail-rake-operations/options/rakes",
      { params: { stage } },
    );
    return unwrapApiResponse(response);
  },

  calculate: async (body: CalculateRailRakeOperationBody) => {
    const response = await api.post<
      ApiResponse<
        Array<RailRakeOperationCalculation & { type: "DEMURRAGE" | "WHARFAGE" }>
      >
    >("/rail-rake-operations/calculate", body);
    return unwrapApiResponse(response);
  },

  create: async (body: CreateRailRakeOperationBody) => {
    const response = await api.post<ApiResponse<RailRakeOperationDetail>>(
      "/rail-rake-operations",
      body,
    );
    return unwrapApiResponse(response);
  },

  detail: async (id: string) => {
    const response = await api.get<ApiResponse<RailRakeOperationDetail>>(
      `/rail-rake-operations/${encodeURIComponent(id)}`,
    );
    return unwrapApiResponse(response);
  },

  update: async (id: string, body: UpdateRailRakeOperationBody) => {
    const response = await api.patch<ApiResponse<RailRakeOperationDetail>>(
      `/rail-rake-operations/${encodeURIComponent(id)}`,
      body,
    );
    return unwrapApiResponse(response);
  },

  submit: async (id: string, version: number) => {
    const response = await api.post<ApiResponse<RailRakeOperationDetail>>(
      `/rail-rake-operations/${encodeURIComponent(id)}/submit`,
      { version },
    );
    return unwrapApiResponse(response);
  },

  remove: async (id: string) => {
    const response = await api.delete<
      ApiResponse<{ id: string; deleted: true }>
    >(`/rail-rake-operations/${encodeURIComponent(id)}`);
    return unwrapApiResponse(response);
  },
};
