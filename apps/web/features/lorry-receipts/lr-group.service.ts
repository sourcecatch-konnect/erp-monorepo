import { api } from "@/lib/api";
import type {
  ApiResponse,
  LRGroup,
  LRGroupListItem,
  CreateLRGroupBody,
  UpdateLRGroupBody,
  FinaliseGroupBody,
  SplitGroupAtHubBody,
  CancelGroupBody,
  LRGroupLineInput,
  FinaliseGroupFormInput,
} from "@skerp/types";
import {
  type ListQuery,
  type ListResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../masters/_shared/master-api";

export const lrGroupApi = {
  list: async (query?: ListQuery): Promise<ListResult<LRGroupListItem>> => {
    const params: Record<string, string | number> = {};
    if (query?.page !== undefined) params.page = query.page;
    if (query?.size !== undefined) params.size = query.size;
    if (query?.search) params.search = query.search;
    if (query?.sort) params.sort = query.sort;
    if (query?.filter?.status) params["filter[status]"] = String(query.filter.status);
    if (query?.filter?.orderId) params["filter[orderId]"] = String(query.filter.orderId);
    const res = await api.get<ApiResponse<LRGroupListItem[]>>("/lr-groups", { params });
    return unwrapListResponse(res);
  },

  statusCounts: async (): Promise<Record<string, number>> => {
    const res = await api.get<ApiResponse<Record<string, number>>>(
      "/lr-groups/status-counts",
    );
    return unwrapApiResponse(res);
  },

detail: async (identifier: string): Promise<LRGroup> => {
  const cleanIdentifier = decodeURIComponent(identifier);

  const res = await api.get<ApiResponse<LRGroup>>(
    `/lr-groups/${encodeURIComponent(cleanIdentifier)}`
  );

  return unwrapApiResponse(res);
},
  create: async (body: CreateLRGroupBody): Promise<LRGroup> => {
    const res = await api.post<ApiResponse<LRGroup>>("/lr-groups", body);
    return unwrapApiResponse(res);
  },

  update: async (
    id: string,
    body: UpdateLRGroupBody & { version?: number },
  ): Promise<LRGroup> => {
    const res = await api.patch<ApiResponse<LRGroup>>(`/lr-groups/${id}`, body);
    return unwrapApiResponse(res);
  },

  finalise: async (
  id: string,
  body: FinaliseGroupFormInput,
): Promise<LRGroup> => {
    const res = await api.post<ApiResponse<LRGroup>>(`/lr-groups/${id}/finalise`, body);
    return unwrapApiResponse(res);
  },

  splitAtHub: async (id: string, body: SplitGroupAtHubBody): Promise<LRGroup> => {
    const res = await api.post<ApiResponse<LRGroup>>(`/lr-groups/${id}/split-at-hub`, body);
    return unwrapApiResponse(res);
  },

  cancel: async (id: string, body: CancelGroupBody): Promise<LRGroup> => {
    const res = await api.post<ApiResponse<LRGroup>>(`/lr-groups/${id}/cancel`, body);
    return unwrapApiResponse(res);
  },

  addLorryReceipt: async (id: string, body: LRGroupLineInput): Promise<LRGroup> => {
    const res = await api.post<ApiResponse<LRGroup>>(`/lr-groups/${id}/lorry-receipts`, body);
    return unwrapApiResponse(res);
  },
};
