import { api } from "@/lib/api";
import type {
  ApiResponse,
  VehicleType,
  CreateVehicleTypeBody,
  UpdateVehicleTypeBody,
} from "@skerp/types";
import {
  ListQuery,
  ListResult,
  BulkImportResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../_shared/master-api";

export const vehicleTypeApi = {
  list: async (query?: ListQuery): Promise<ListResult<VehicleType>> => {
    const res = await api.get<ApiResponse<VehicleType[]>>("/vehicle-types", {
      params: query,
    });
    return unwrapListResponse(res);
  },
  detail: async (id: string): Promise<VehicleType> => {
    const res = await api.get<ApiResponse<VehicleType>>(`/vehicle-types/${id}`);
    return unwrapApiResponse(res);
  },
  create: async (body: CreateVehicleTypeBody): Promise<VehicleType> => {
    const res = await api.post<ApiResponse<VehicleType>>("/vehicle-types", body);
    return unwrapApiResponse(res);
  },
  update: async (
    id: string,
    body: UpdateVehicleTypeBody
  ): Promise<VehicleType> => {
    const res = await api.patch<ApiResponse<VehicleType>>(
      `/vehicle-types/${id}`,
      body
    );
    return unwrapApiResponse(res);
  },
  remove: async (id: string): Promise<void> => {
    const res = await api.delete<ApiResponse<null>>(`/vehicle-types/${id}`);
    unwrapApiResponse(res);
  },
  bulkRemove: async (ids: string[]) => {
    const res = await api.post<ApiResponse<{ count: number }>>(
      "/vehicle-types/bulk-delete",
      { ids }
    );
    return unwrapApiResponse(res);
  },
  bulkImport: async (
    rows: CreateVehicleTypeBody[]
  ): Promise<BulkImportResult> => {
    const res = await api.post<ApiResponse<BulkImportResult>>(
      "/vehicle-types/bulk-import",
      { rows }
    );
    return unwrapApiResponse(res);
  },
  export: async (query?: ListQuery): Promise<Blob> => {
    const res = await api.get<Blob>("/vehicle-types/export", {
      params: query,
      responseType: "blob",
    });
    return res.data;
  },
};
