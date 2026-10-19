import { api } from "@/lib/api";
import type {
  ApiResponse,
  FeedbackBulkStatusBody,
  FeedbackCategory,
  FeedbackCreated,
  FeedbackDetail,
  FeedbackListItem,
  FeedbackSeverity,
  FeedbackStatus,
  FeedbackSubmitBody,
  FeedbackSummary,
  FeedbackTriageInput,
  MyFeedbackItem,
} from "@skerp/types";
import {
  unwrapApiResponse,
  unwrapListResponse,
  type ListResult,
} from "@/features/masters/_shared/master-api";

export type FeedbackListParams = {
  page: number;
  size: number;
  search?: string;
  status?: FeedbackStatus | "OPEN";
  category?: FeedbackCategory;
  severity?: FeedbackSeverity;
  module?: string;
  pageTitle?: string;
};

type FeedbackFilters = Omit<FeedbackListParams, "page" | "size">;

const filterQuery = ({ search, ...filters }: FeedbackFilters) => {
  const params: Record<string, string> = {};
  if (search) params.search = search;
  for (const [key, value] of Object.entries(filters)) {
    if (value) params[`filter[${key}]`] = value;
  }
  return params;
};

export const feedbackApi = {
  /** 404 when the server flag is off — the launcher then hides itself. */
  status: async (): Promise<{ enabled: boolean }> =>
    unwrapApiResponse(
      await api.get<ApiResponse<{ enabled: boolean }>>("/feedback/status"),
    ),

  submit: async (body: FeedbackSubmitBody): Promise<FeedbackCreated> =>
    unwrapApiResponse(
      await api.post<ApiResponse<FeedbackCreated>>("/feedback", body),
    ),

  mine: async (): Promise<MyFeedbackItem[]> =>
    unwrapApiResponse(
      await api.get<ApiResponse<MyFeedbackItem[]>>("/feedback/mine"),
    ),

  summary: async (): Promise<FeedbackSummary> =>
    unwrapApiResponse(
      await api.get<ApiResponse<FeedbackSummary>>("/feedback/summary"),
    ),

  list: async ({
    page,
    size,
    ...filters
  }: FeedbackListParams): Promise<ListResult<FeedbackListItem>> =>
    unwrapListResponse(
      await api.get<ApiResponse<FeedbackListItem[]>>("/feedback", {
        params: { page, size, ...filterQuery(filters) },
      }),
    ),

  detail: async (id: string): Promise<FeedbackDetail> =>
    unwrapApiResponse(
      await api.get<ApiResponse<FeedbackDetail>>(`/feedback/${id}`),
    ),

  triage: async (
    id: string,
    body: FeedbackTriageInput,
  ): Promise<FeedbackDetail> =>
    unwrapApiResponse(
      await api.patch<ApiResponse<FeedbackDetail>>(`/feedback/${id}`, body),
    ),

  bulkStatus: async (
    body: FeedbackBulkStatusBody,
  ): Promise<{ updated: number }> =>
    unwrapApiResponse(
      await api.patch<ApiResponse<{ updated: number }>>(
        "/feedback/bulk",
        body,
      ),
    ),

  /** Same filters as the list, without paging. */
  exportXlsx: async (filters: FeedbackFilters): Promise<Blob> => {
    const res = await api.get<Blob>("/feedback/export/xlsx", {
      params: filterQuery(filters),
      responseType: "blob",
    });
    return res.data;
  },
};
