import { api } from "@/lib/api";
import type {
  ApiResponse,
  CustomerLocation,
  CreateCustomerLocationBody,
  UpdateCustomerLocationBody,
} from "@skerp/types";
import { unwrapApiResponse } from "../_shared/master-api";

export const customerLocationApi = {
  list: async (customerId: string): Promise<CustomerLocation[]> => {
    const res = await api.get<ApiResponse<CustomerLocation[]>>(
      `/customers/${customerId}/locations`
    );
    return unwrapApiResponse(res);
  },
  create: async (
    customerId: string,
    body: CreateCustomerLocationBody
  ): Promise<CustomerLocation> => {
    const res = await api.post<ApiResponse<CustomerLocation>>(
      `/customers/${customerId}/locations`,
      body
    );
    return unwrapApiResponse(res);
  },
  update: async (
    locationId: string,
    body: UpdateCustomerLocationBody
  ): Promise<CustomerLocation> => {
    const res = await api.patch<ApiResponse<CustomerLocation>>(
      `/customers/locations/${locationId}`,
      body
    );
    return unwrapApiResponse(res);
  },
  remove: async (locationId: string): Promise<void> => {
    const res = await api.delete<ApiResponse<{ success: boolean }>>(
      `/customers/locations/${locationId}`
    );
    unwrapApiResponse(res);
  },
};

export const customerLocationKeys = {
  list: (customerId: string) =>
    ["customer-locations", customerId] as const,
};
