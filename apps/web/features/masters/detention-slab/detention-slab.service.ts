import { api } from "@/lib/api";
import type {
  ApiResponse,
  CreateDetentionSlabBody,
  DetentionSlab,
  UpdateDetentionSlabBody,
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
  create: async (body: CreateDetentionSlabBody): Promise<DetentionSlab> => {
    const res = await api.post<ApiResponse<DetentionSlab>>(
      "/detention/slabs",
      body,
    );
    return unwrapApiResponse(res);
  },
  /** PUT: the slab and its bands are replaced as a whole. */
  update: async (
    id: string,
    body: UpdateDetentionSlabBody,
  ): Promise<DetentionSlab> => {
    const res = await api.put<ApiResponse<DetentionSlab>>(
      `/detention/slabs/${id}`,
      body,
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
