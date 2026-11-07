import { api } from "@/lib/api";
import type {
  ApiResponse,
  CreateDetentionSlabFormInput,
  DetentionQuote,
  DetentionSlab,
  UpdateDetentionSlabFormInput,
} from "@skerp/types";
import {
  type ListQuery,
  type ListResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../_shared/master-api";

/** Bespoke router (`/detention/slabs`), not the CRUD factory: no bulk ops. */
export const detentionSlabApi = {
  list: async (query?: ListQuery): Promise<ListResult<DetentionSlab>> => {
    const res = await api.get<ApiResponse<DetentionSlab[]>>(
      "/detention/slabs",
      { params: query },
    );
    return unwrapListResponse(res);
  },
  create: async (
    body: CreateDetentionSlabFormInput,
  ): Promise<DetentionSlab> => {
    const res = await api.post<ApiResponse<DetentionSlab>>(
      "/detention/slabs",
      body,
    );
    return unwrapApiResponse(res);
  },
  /** PUT: the slab and its bands are replaced as a whole. */
  update: async (
    id: string,
    body: UpdateDetentionSlabFormInput,
  ): Promise<DetentionSlab> => {
    const res = await api.put<ApiResponse<DetentionSlab>>(
      `/detention/slabs/${id}`,
      body,
    );
    return unwrapApiResponse(res);
  },

  /**
   * Why a challan's detention is what it is. Read-only — nothing is written,
   * so it is safe to call for any challan the user can see.
   */
  quote: async (
    challanId: string,
    overrides?: { reportingAt?: string; unloadingAt?: string; slabId?: string },
  ): Promise<DetentionQuote> => {
    const res = await api.get<ApiResponse<DetentionQuote>>(
      `/detention/challans/${challanId}/quote`,
      { params: overrides },
    );
    return unwrapApiResponse(res);
  },
  remove: async (id: string): Promise<void> => {
    const res = await api.delete<ApiResponse<{ id: string }>>(
      `/detention/slabs/${id}`,
    );
    unwrapApiResponse(res);
  },
};
