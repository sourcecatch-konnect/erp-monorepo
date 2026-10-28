import axios from "axios";
import { api } from "@/lib/api";
import type {
  ApiResponse,
  FeedbackBulkStatusBody,
  FeedbackCategory,
  FeedbackComment,
  FeedbackCommentBody,
  FeedbackConfirmBody,
  FeedbackCreated,
  FeedbackDetail,
  FeedbackFileComplete,
  FeedbackFileRequest,
  FeedbackFileUpload,
  FeedbackImpact,
  FeedbackListItem,
  FeedbackStatus,
  FeedbackStatusInfo,
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
  impact?: FeedbackImpact;
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

const download = async (path: string, filters: FeedbackFilters): Promise<Blob> => {
  const res = await api.get<Blob>(path, {
    params: filterQuery(filters),
    responseType: "blob",
  });
  return res.data;
};

export const feedbackApi = {
  /** 404 when the server flag is off — the launcher then hides itself. */
  status: async (): Promise<FeedbackStatusInfo> =>
    unwrapApiResponse(
      await api.get<ApiResponse<FeedbackStatusInfo>>("/feedback/status"),
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
  exportXlsx: (filters: FeedbackFilters) => download("/feedback/export/xlsx", filters),
  exportDocx: (filters: FeedbackFilters) => download("/feedback/export/docx", filters),

  /* ---- Files + voice note ---- */

  requestFile: async (
    id: string,
    body: FeedbackFileRequest,
  ): Promise<FeedbackFileUpload> =>
    unwrapApiResponse(
      await api.post<ApiResponse<FeedbackFileUpload>>(`/feedback/${id}/files`, body),
    ),

  /**
   * PUT the file straight to storage with the presigned URL. Bare axios on
   * purpose (same as @skerp/attachments-web): no cookies go to S3. The
   * Content-Type must equal the type the URL was signed for.
   */
  uploadToStorage: async (
    uploadUrl: string,
    blob: Blob,
    contentType: string,
    onProgress?: (fraction: number) => void,
  ): Promise<void> => {
    await axios.put(uploadUrl, blob, {
      headers: { "Content-Type": contentType },
      onUploadProgress: (event) => {
        if (onProgress && event.total) onProgress(event.loaded / event.total);
      },
    });
  },

  completeFile: async (
    id: string,
    attachmentId: string,
    body: FeedbackFileComplete = {},
  ): Promise<void> => {
    await api.post(`/feedback/${id}/files/${attachmentId}/complete`, body);
  },

  /* ---- B8: conversation ---- */

  comments: async (id: string): Promise<FeedbackComment[]> =>
    unwrapApiResponse(
      await api.get<ApiResponse<FeedbackComment[]>>(`/feedback/${id}/comments`),
    ),

  addComment: async (id: string, body: FeedbackCommentBody): Promise<FeedbackComment> =>
    unwrapApiResponse(
      await api.post<ApiResponse<FeedbackComment>>(`/feedback/${id}/comments`, body),
    ),

  confirm: async (id: string, body: FeedbackConfirmBody): Promise<void> => {
    await api.post(`/feedback/${id}/confirm`, body);
  },
};
