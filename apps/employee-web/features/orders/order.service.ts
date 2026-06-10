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
} from "@skerp/types";
import type { ListQuery, ListResult } from "@/lib/master-api";
import { unwrapApiResponse, unwrapListResponse } from "@/lib/master-api";

export type OrderDetail = Order & { freightPreview: FreightPreview };

export type OrderQuickView = Pick<Order,
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

export const orderApi = {
    list: async (query?: ListQuery): Promise<ListResult<Order>> => {
        const params: Record<string, string | number> = {};
        if (query?.page !== undefined) params.page = query.page;
        if (query?.size !== undefined) params.size = query.size;
        if (query?.search) params.search = query.search;
        if (query?.sort) params.sort = query.sort;
        if (query?.filter?.status)
            params["filter[status]"] = String(query.filter.status);
        const res = await api.get<ApiResponse<Order[]>>("/orders", { params });
        return unwrapListResponse(res);
    },

    statusCounts: async (): Promise<Record<string, number>> => {
        const res = await api.get<ApiResponse<Record<string, number>>>(
            "/orders/status-counts"
        );
        return unwrapApiResponse(res);
    },

    quickView: async (id: string): Promise<OrderQuickView> => {
        const res = await api.get<ApiResponse<OrderQuickView>>(`/orders/${id}`, {
            params: { view: "quick" },
        });
        return unwrapApiResponse(res);
    },

    detail: async (id: string): Promise<OrderDetail> => {
        const res = await api.get<ApiResponse<OrderDetail>>(`/orders/${id}`);
        return unwrapApiResponse(res);
    },

    create: async (body: CreateOrderBody): Promise<Order> => {
        const res = await api.post<ApiResponse<Order>>("/orders", body);
        return unwrapApiResponse(res);
    },

    update: async (
        id: string,
        body: UpdateOrderBody & { version?: number }
    ): Promise<Order> => {
        const res = await api.patch<ApiResponse<Order>>(`/orders/${id}`, body);
        return unwrapApiResponse(res);
    },

    approve: async (id: string, body: ApproveOrderBody): Promise<Order> => {
        const res = await api.post<ApiResponse<Order>>(`/orders/${id}/approve`, body);
        return unwrapApiResponse(res);
    },

    reject: async (id: string, body: RejectOrderBody): Promise<Order> => {
        const res = await api.post<ApiResponse<Order>>(`/orders/${id}/reject`, body);
        return unwrapApiResponse(res);
    },

    cancel: async (id: string, body: CancelOrderBody): Promise<Order> => {
        const res = await api.post<ApiResponse<Order>>(`/orders/${id}/cancel`, body);
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
};

type NamedRow = { id: string; name: string };
type BranchRow = { id: string; name: string; shortCode: string };
type VehicleTypeRow = { id: string; name: string; code: string; isActive: boolean };
const LOOKUP_QUERY = { size: 1000, sort: "name:asc" } as const;

export const orderLookups = {
    customers: async (): Promise<NamedRow[]> =>
        unwrapListResponse(
            await api.get<ApiResponse<NamedRow[]>>("/customers", {
                params: LOOKUP_QUERY,
            })
        ).data,
    branches: async (): Promise<BranchRow[]> =>
        unwrapListResponse(
            await api.get<ApiResponse<BranchRow[]>>("/branches", {
                params: LOOKUP_QUERY,
            })
        ).data,
    goods: async (): Promise<NamedRow[]> =>
        unwrapListResponse(
            await api.get<ApiResponse<NamedRow[]>>("/goods", {
                params: LOOKUP_QUERY,
            })
        ).data,
    vehicleTypes: async (): Promise<VehicleTypeRow[]> =>
        unwrapListResponse(
            await api.get<ApiResponse<VehicleTypeRow[]>>("/vehicle-types", {
                params: LOOKUP_QUERY,
            })
        ).data,
};

export const orderLookupKeys = {
    customers: ["lookup", "customers"] as const,
    branches: ["lookup", "branches"] as const,
    goods: ["lookup", "goods"] as const,
    vehicleTypes: ["lookup", "vehicle-types"] as const,
    customerLocations: (customerId: string) =>
        ["lookup", "customer-locations", customerId] as const,
};