import { api } from "@/lib/api";
import type {
  ApiResponse,
  Vehicle,
  CreateVehicleBody,
  UpdateVehicleBody,
} from "@skerp/types";
import {
  ListQuery,
  ListResult,
  BulkImportResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../_shared/master-api";

export const vehicleApi = {
  list: async (query?: ListQuery): Promise<ListResult<Vehicle>> => {
    const res = await api.get<ApiResponse<Vehicle[]>>("/vehicles", {
      params: query,
    });

    return unwrapListResponse(res);
  },

  detail: async (id: string): Promise<Vehicle> => {
    const res = await api.get<ApiResponse<Vehicle>>(`/vehicles/${id}`);

    return unwrapApiResponse(res);
  },

  create: async (body: CreateVehicleBody): Promise<Vehicle> => {
    const res = await api.post<ApiResponse<Vehicle>>("/vehicles", body);

    return unwrapApiResponse(res);
  },

  update: async (
    id: string,
    body: UpdateVehicleBody
  ): Promise<Vehicle> => {
    const res = await api.patch<ApiResponse<Vehicle>>(`/vehicles/${id}`, body);

    return unwrapApiResponse(res);
  },

  remove: async (id: string): Promise<void> => {
    const res = await api.delete<ApiResponse<null>>(`/vehicles/${id}`);

    unwrapApiResponse(res);
  },

  bulkRemove: async (ids: string[]) => {
    const res = await api.post<ApiResponse<{ count: number }>>(
      "/vehicles/bulk-delete",
      { ids }
    );

    return unwrapApiResponse(res);
  },

  bulkImport: async (
    rows: CreateVehicleBody[]
  ): Promise<BulkImportResult> => {
    const res = await api.post<ApiResponse<BulkImportResult>>(
      "/vehicles/bulk-import",
      { rows }
    );

    return unwrapApiResponse(res);
  },

  export: async (query?: ListQuery): Promise<Blob> => {
    const res = await api.get<Blob>("/vehicles/export", {
      params: query,
      responseType: "blob",
    });

    return res.data;
  },

  search: async (q: string): Promise<Vehicle[]> => {
    const res = await api.get<ApiResponse<Vehicle[]>>("/vehicles/search", {
      params: { q },
    });

    return unwrapApiResponse(res);
  },

  lookup: async (query?: {
    search?: string;
    page?: number;
    size?: number;
    ownershipType?: string;
  }): Promise<ListResult<Vehicle>> => {
    const params: Record<string, string | number> = {
      page: query?.page ?? 0,
      size: query?.size ?? 20,
    };

    if (query?.search) params.search = query.search;
    if (query?.ownershipType) params["filter[ownershipType]"] = query.ownershipType;

    const res = await api.get<ApiResponse<Vehicle[]>>("/vehicles/lookup", {
      params,
    });

    return unwrapListResponse(res);
  },
};
