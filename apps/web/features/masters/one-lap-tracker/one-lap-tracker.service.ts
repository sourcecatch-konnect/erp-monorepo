import { api } from "@/lib/api";
import type {
    ApiResponse,
    OneLapTracker,
    OneLapTrackerStatusCounts,
    OneLapTrackerSyncResult,
    UpdateOneLapTrackerBody,
} from "@skerp/types";

import {
    type ListQuery,
    type ListResult,
    unwrapApiResponse,
    unwrapListResponse,
} from "../_shared/master-api";

export const oneLapTrackerApi = {
    list: async (
        query?: ListQuery,
    ): Promise<ListResult<OneLapTracker>> => {
        const res = await api.get<ApiResponse<OneLapTracker[]>>(
            "/one-lap-trackers",
            { params: query },
        );

        return unwrapListResponse(res);
    },

    detail: async (id: string): Promise<OneLapTracker> => {
        const res = await api.get<ApiResponse<OneLapTracker>>(
            `/one-lap-trackers/${id}`,
        );

        return unwrapApiResponse(res);
    },

    statusCounts: async (): Promise<OneLapTrackerStatusCounts> => {
        const res = await api.get<ApiResponse<OneLapTrackerStatusCounts>>(
            "/one-lap-trackers/status-counts",
        );

        return unwrapApiResponse(res);
    },

    sync: async (): Promise<OneLapTrackerSyncResult> => {
        const res = await api.post<ApiResponse<OneLapTrackerSyncResult>>(
            "/one-lap-trackers/sync",
        );

        return unwrapApiResponse(res);
    },

    update: async (
        id: string,
        body: UpdateOneLapTrackerBody,
    ): Promise<OneLapTracker> => {
        const res = await api.patch<ApiResponse<OneLapTracker>>(
            `/one-lap-trackers/${id}`,
            body,
        );

        return unwrapApiResponse(res);
    },
};