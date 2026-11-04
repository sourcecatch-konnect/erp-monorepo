import { api } from "@/lib/api";
import type {
  AddClaimRecoveryFormInput,
  ApiResponse,
  ClaimFundingAccount,
  ReceiveClaimRecoveryFormInput,
  ClaimAssessmentFormInput,
  ClaimCause,
  ClaimDetail,
  ClaimEligibleLr,
  ClaimListRow,
  ClaimReasonInput,
  ClaimSettlementOptions,
  ClaimStatus,
  ClaimStatusSummary,
  ClaimType,
  CreateClaimFormInput,
  SettleClaimFormInput,
} from "@skerp/types";
import {
  unwrapApiResponse,
  unwrapListResponse,
  type ListResult,
} from "@/features/masters/_shared/master-api";

/** Register filters; every one combines with the others on the server. */
export type ClaimFilters = {
  search?: string;
  status?: ClaimStatus;
  claimType?: ClaimType;
  causedBy?: ClaimCause;
  branchId?: string;
  customerId?: string;
  /** All claims on the LRs of one group (LR detail page). */
  lrGroupId?: string;
  /** yyyy-mm-dd */
  dateFrom?: string;
  /** yyyy-mm-dd, inclusive */
  dateTo?: string;
};

export type ClaimListParams = ClaimFilters & {
  page: number;
  size: number;
  /** "field:asc" | "field:desc" */
  sort?: string;
};

export const claimApi = {
  list: async (params: ClaimListParams): Promise<ListResult<ClaimListRow>> => {
    const res = await api.get<ApiResponse<ClaimListRow[]>>("/claims", { params });
    return unwrapListResponse(res);
  },

  summary: async (filters: ClaimFilters): Promise<ClaimStatusSummary[]> => {
    const res = await api.get<ApiResponse<ClaimStatusSummary[]>>("/claims/summary", {
      params: filters,
    });
    return unwrapApiResponse(res);
  },

  get: async (id: string): Promise<ClaimDetail> => {
    const res = await api.get<ApiResponse<ClaimDetail>>(`/claims/${id}`);
    return unwrapApiResponse(res);
  },

  /* C4 — every action answers with the updated claim. */

  eligibleLrs: async (search: string): Promise<ClaimEligibleLr[]> => {
    const res = await api.get<ApiResponse<ClaimEligibleLr[]>>("/claims/eligible-lrs", {
      params: { search },
    });
    return unwrapApiResponse(res);
  },

  create: async (values: CreateClaimFormInput): Promise<ClaimDetail> => {
    const res = await api.post<ApiResponse<ClaimDetail>>("/claims", values);
    return unwrapApiResponse(res);
  },

  assess: async (id: string, values: ClaimAssessmentFormInput): Promise<ClaimDetail> => {
    const res = await api.post<ApiResponse<ClaimDetail>>(`/claims/${id}/assess`, values);
    return unwrapApiResponse(res);
  },

  updateAssessment: async (
    id: string,
    values: ClaimAssessmentFormInput,
  ): Promise<ClaimDetail> => {
    const res = await api.patch<ApiResponse<ClaimDetail>>(`/claims/${id}`, values);
    return unwrapApiResponse(res);
  },

  settlementOptions: async (id: string): Promise<ClaimSettlementOptions> => {
    const res = await api.get<ApiResponse<ClaimSettlementOptions>>(
      `/claims/${id}/settlement-options`,
    );
    return unwrapApiResponse(res);
  },

  settle: async (id: string, values: SettleClaimFormInput): Promise<ClaimDetail> => {
    const res = await api.post<ApiResponse<ClaimDetail>>(`/claims/${id}/settle`, values);
    return unwrapApiResponse(res);
  },

  approveSettlement: async (id: string, version: number): Promise<ClaimDetail> => {
    const res = await api.post<ApiResponse<ClaimDetail>>(`/claims/${id}/settlement/approve`, {
      version,
    });
    return unwrapApiResponse(res);
  },

  declineSettlement: async (id: string, body: ClaimReasonInput): Promise<ClaimDetail> => {
    const res = await api.post<ApiResponse<ClaimDetail>>(
      `/claims/${id}/settlement/decline`,
      body,
    );
    return unwrapApiResponse(res);
  },

  reject: async (id: string, body: ClaimReasonInput): Promise<ClaimDetail> => {
    const res = await api.post<ApiResponse<ClaimDetail>>(`/claims/${id}/reject`, body);
    return unwrapApiResponse(res);
  },

  cancel: async (id: string, body: ClaimReasonInput): Promise<ClaimDetail> => {
    const res = await api.post<ApiResponse<ClaimDetail>>(`/claims/${id}/cancel`, body);
    return unwrapApiResponse(res);
  },

  /* C5 — recovery lines. `version` is the claim's. */

  fundingAccounts: async (id: string): Promise<ClaimFundingAccount[]> => {
    const res = await api.get<ApiResponse<ClaimFundingAccount[]>>(`/claims/${id}/funding-accounts`);
    return unwrapApiResponse(res);
  },

  addRecovery: async (id: string, values: AddClaimRecoveryFormInput): Promise<ClaimDetail> => {
    const res = await api.post<ApiResponse<ClaimDetail>>(`/claims/${id}/recoveries`, values);
    return unwrapApiResponse(res);
  },

  approveRecovery: async (id: string, recoveryId: string, version: number): Promise<ClaimDetail> => {
    const res = await api.post<ApiResponse<ClaimDetail>>(
      `/claims/${id}/recoveries/${recoveryId}/approve`,
      { version },
    );
    return unwrapApiResponse(res);
  },

  receiveRecovery: async (
    id: string,
    recoveryId: string,
    values: ReceiveClaimRecoveryFormInput,
  ): Promise<ClaimDetail> => {
    const res = await api.post<ApiResponse<ClaimDetail>>(
      `/claims/${id}/recoveries/${recoveryId}/receive`,
      values,
    );
    return unwrapApiResponse(res);
  },

  rejectRecovery: async (
    id: string,
    recoveryId: string,
    body: ClaimReasonInput,
  ): Promise<ClaimDetail> => {
    const res = await api.post<ApiResponse<ClaimDetail>>(
      `/claims/${id}/recoveries/${recoveryId}/reject`,
      body,
    );
    return unwrapApiResponse(res);
  },
};
