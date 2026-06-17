import { api } from "@/lib/api";
import type {
  ApiResponse,
  Order,
  CreateOrderBody,
  UpdateOrderBody,
  ApproveOrderBody,
  RejectOrderBody,
  CancelOrderBody,
  FreightPreview,
  CustomerLocation,
  Route,
} from "@skerp/types";
import {
  ListQuery,
  ListResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../masters/_shared/master-api";

type OrderCityLite = {
  id: string;
  name: string;
};

type OrderBranchLite = {
  id: string;
  name?: string | null;
  shortCode?: string | null;
};

type OrderRouteDetail = {
  id: string;
  sourceCity?: OrderCityLite | null;
  destinationCity?: OrderCityLite | null;
};

type OrderRateMatrixDetail = {
  id?: string;
  rate?: number | null;
  remarks?: string | null;
  agreement?: {
    id?: string;
    client?: {
      id?: string;
      name?: string | null;
    } | null;
    company?: {
      id?: string;
      name?: string | null;
    } | null;
  } | null;
  route?: OrderRouteDetail | null;
};

type OrderFreightPreviewDetail = FreightPreview & {
  rateMatrix?: OrderRateMatrixDetail | null;
};

export type OrderDetail = Order & {
  route?: OrderRouteDetail | null;
  fromBranch?: OrderBranchLite | null;
  toBranch?: OrderBranchLite | null;
  freightPreview?: OrderFreightPreviewDetail | null;
};
const encodeOrderIdentifier = (identifier: string) =>
  encodeURIComponent(identifier);

export const orderApi = {
  list: async (query?: ListQuery): Promise<ListResult<Order>> => {
    const params: Record<string, string | number> = {};

    if (query?.page !== undefined) params.page = query.page;
    if (query?.size !== undefined) params.size = query.size;
    if (query?.search) params.search = query.search;
    if (query?.sort) {
      params.sort = query.sort;
    }

    if (query?.filter?.status) {
      params["filter[status]"] = String(query.filter.status);
    }

    const res = await api.get<ApiResponse<Order[]>>("/orders", { params });
    return unwrapListResponse(res);
  },

  statusCounts: async (): Promise<Record<string, number>> => {
    const res = await api.get<ApiResponse<Record<string, number>>>(
      "/orders/status-counts"
    );
    return unwrapApiResponse(res);
  },

  detail: async (identifier: string): Promise<OrderDetail> => {
    const res = await api.get<ApiResponse<OrderDetail>>(
      `/orders/${encodeOrderIdentifier(identifier)}`
    );
    return unwrapApiResponse(res);
  },

  quickView: async (identifier: string): Promise<OrderQuickView> => {
    const res = await api.get<ApiResponse<OrderQuickView>>(
      `/orders/${encodeOrderIdentifier(identifier)}`,
      {
        params: { view: "quick" },
      }
    );
    return unwrapApiResponse(res);
  },
  downloadPdf: async (identifier: string): Promise<Blob> => {
    const res = await api.get(
      `/orders/${encodeOrderIdentifier(identifier)}/pdf`,
      {
        responseType: "blob",
      }
    );

    return res.data;
  },

  create: async (body: CreateOrderBody): Promise<Order> => {
    const res = await api.post<ApiResponse<Order>>("/orders", body);
    return unwrapApiResponse(res);
  },

  update: async (
    identifier: string,
    body: UpdateOrderBody & { version?: number }
  ): Promise<Order> => {
    const res = await api.patch<ApiResponse<Order>>(
      `/orders/${encodeOrderIdentifier(identifier)}`,
      body
    );
    return unwrapApiResponse(res);
  },

  approve: async (
    identifier: string,
    body: ApproveOrderBody
  ): Promise<Order> => {
    const res = await api.post<ApiResponse<Order>>(
      `/orders/${encodeOrderIdentifier(identifier)}/approve`,
      body
    );
    return unwrapApiResponse(res);
  },

  reject: async (
    identifier: string,
    body: RejectOrderBody
  ): Promise<Order> => {
    const res = await api.post<ApiResponse<Order>>(
      `/orders/${encodeOrderIdentifier(identifier)}/reject`,
      body
    );
    return unwrapApiResponse(res);
  },

  cancel: async (
    identifier: string,
    body: CancelOrderBody
  ): Promise<Order> => {
    const res = await api.post<ApiResponse<Order>>(
      `/orders/${encodeOrderIdentifier(identifier)}/cancel`,
      body
    );
    return unwrapApiResponse(res);
  },

  customerLocations: async (
    customerId: string
  ): Promise<CustomerLocation[]> => {
    const res = await api.get<ApiResponse<CustomerLocation[]>>(
      `/customers/${customerId}/locations`
    );
    return unwrapApiResponse(res);
  },
  delete: async (identifier: string): Promise<Order> => {
    const res = await api.delete<ApiResponse<Order>>(
      `/orders/${encodeOrderIdentifier(identifier)}`
    );

    return unwrapApiResponse(res);
  },
};
/* ------------------------------------------------------------------ */
/* Lookups for the order form (reuse master list endpoints)           */
/* ------------------------------------------------------------------ */

type NamedRow = { id: string; name: string };
type BranchRow = { id: string; name: string; shortCode: string };
type VehicleTypeRow = { id: string; name: string; code: string; isActive: boolean };

const LOOKUP_QUERY = { size: 1000, sort: "name:asc" } as const;

export const orderLookups = {
  customers: async (): Promise<NamedRow[]> => {
    const res = await api.get<ApiResponse<NamedRow[]>>("/customers", {
      params: LOOKUP_QUERY,
    });
    return unwrapListResponse(res).data;
  },
  branches: async (): Promise<BranchRow[]> => {
    const res = await api.get<ApiResponse<BranchRow[]>>("/branches", {
      params: LOOKUP_QUERY,
    });
    return unwrapListResponse(res).data;
  },
  goods: async (): Promise<NamedRow[]> => {
    const res = await api.get<ApiResponse<NamedRow[]>>("/goods", {
      params: LOOKUP_QUERY,
    });
    return unwrapListResponse(res).data;
  },
  routes: async (): Promise<Route[]> => {
    const res = await api.get<ApiResponse<Route[]>>("/routes", {
      params: {
        size: 1000,
      },
    });

    return unwrapListResponse(res).data;
  },
  vehicleTypes: async (): Promise<VehicleTypeRow[]> => {
    const res = await api.get<ApiResponse<VehicleTypeRow[]>>("/vehicle-types", {
      params: LOOKUP_QUERY,
    });
    return unwrapListResponse(res).data;
  },
};

export const orderLookupKeys = {
  customers: ["lookup", "customers"] as const,
  branches: ["lookup", "branches"] as const,
  routes: ["order-lookups", "routes"] as const,
  goods: ["lookup", "goods"] as const,
  vehicleTypes: ["lookup", "vehicle-types"] as const,
  customerLocations: (customerId: string) =>
    ["lookup", "customer-locations", customerId] as const,
};
export type OrderQuickView = Pick<
  Order,
  | "id"
  | "orderNumber"
  | "status"
  | "pickupDate"
  | "orderType"
  | "truckQuantity"
  | "bookingFreightAmount"
  | "contactPersonName"
  | "contactMobile"
  | "contactEmail"
  | "pickupAddressOverride"
> & {
  customer: { id: string; name: string } | null;
  fromBranch: { id: string; shortCode: string } | null;
  toBranch: { id: string; shortCode: string } | null;
  vehicleType: { id: string; name: string } | null;
  customerLocation: { id: string; name: string } | null;
};