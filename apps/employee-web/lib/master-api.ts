import type { AxiosResponse } from "axios";
import type { ApiResponse, ListMeta } from "@skerp/types";

export type ListResult<T> = {
    data: T[];
    meta?: ListMeta;
};

export type ListQuery = {
    page?: number;
    size?: number;
    search?: string;
    sort?: string;
    filter?: Record<string, string>;
};

export const unwrapApiResponse = <T>(
    res: AxiosResponse<ApiResponse<T>>
): T => {
    const response = res.data;
    if (!response.ok) {
        throw new Error(response.error.message);
    }
    return response.data;
};

export const unwrapListResponse = <T>(
    res: AxiosResponse<ApiResponse<T[]>>
): ListResult<T> => {
    const response = res.data;
    if (!response.ok) {
        throw new Error(response.error.message);
    }
    return {
        data: response.data,
        meta: response.meta,
    };
};