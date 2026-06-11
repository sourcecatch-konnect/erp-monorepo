import { api } from "@/lib/api";
import type {
  ApiResponse,
  LorryReceipt,
  LRListItem,
  CreateLRBody,
  UpdateLRBody,
  FinaliseLRBody,
  CancelLRBody,
  AddEwayBillBody,
  EwayBill,
} from "@skerp/types";
import {
  type ListQuery,
  type ListResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../masters/_shared/master-api";

export const lorryReceiptApi = {
  list: async (query?: ListQuery): Promise<ListResult<LRListItem>> => {
    const params: Record<string, string | number> = {};
    if (query?.page !== undefined) params.page = query.page;
    if (query?.size !== undefined) params.size = query.size;
    if (query?.search) params.search = query.search;
    if (query?.sort) params.sort = query.sort;
    if (query?.filter?.status) params["filter[status]"] = String(query.filter.status);
    if (query?.filter?.source) params["filter[source]"] = String(query.filter.source);
    const res = await api.get<ApiResponse<LRListItem[]>>("/lorry-receipts", { params });
    return unwrapListResponse(res);
  },

  statusCounts: async (): Promise<Record<string, number>> => {
    const res = await api.get<ApiResponse<Record<string, number>>>(
      "/lorry-receipts/status-counts"
    );
    return unwrapApiResponse(res);
  },

  detail: async (id: string): Promise<LorryReceipt> => {
    const res = await api.get<ApiResponse<LorryReceipt>>(`/lorry-receipts/${id}`);
    return unwrapApiResponse(res);
  },

  create: async (body: CreateLRBody): Promise<LorryReceipt> => {
    const res = await api.post<ApiResponse<LorryReceipt>>("/lorry-receipts", body);
    return unwrapApiResponse(res);
  },

  update: async (id: string, body: UpdateLRBody & { version?: number }): Promise<LorryReceipt> => {
    const res = await api.patch<ApiResponse<LorryReceipt>>(`/lorry-receipts/${id}`, body);
    return unwrapApiResponse(res);
  },

  finalise: async (id: string, body: FinaliseLRBody): Promise<LorryReceipt> => {
    const res = await api.post<ApiResponse<LorryReceipt>>(
      `/lorry-receipts/${id}/finalise`,
      body
    );
    return unwrapApiResponse(res);
  },

  cancel: async (id: string, body: CancelLRBody): Promise<LorryReceipt> => {
    const res = await api.post<ApiResponse<LorryReceipt>>(
      `/lorry-receipts/${id}/cancel`,
      body
    );
    return unwrapApiResponse(res);
  },

  addEwayBill: async (id: string, body: AddEwayBillBody): Promise<EwayBill> => {
    const res = await api.post<ApiResponse<EwayBill>>(
      `/lorry-receipts/${id}/eway-bills`,
      body
    );
    return unwrapApiResponse(res);
  },
};

/* ------------------------------------------------------------------ */
/* Lookup helpers (reused across LR form)                             */
/* ------------------------------------------------------------------ */

type VehicleRow = { id: string; vehicleNumber: string; ownershipType?: string };
type DriverRow = { id: string; name: string; mobile?: string | null };
type CustomerRow = { id: string; name: string; shortName: string | null };
type BranchRow = { id: string; name: string; branchCode: string; shortCode?: string; isRailHead?: boolean };
type TripRow = {
  id: string;
  tripNumber: string;
  tripName: string;
  status: string;
  vehicle?: { id: string; vehicleNumber: string } | null;
  driver?: { id: string; name: string } | null;
};
type OrderRow = {
  id: string;
  orderNumber: string;
  orderType?: string;
  status?: string;
  pickupDate?: string | null;
  bookingFreightAmount?: number | null;
  truckQuantity: number | null;
  fromBranchId?: string;
  toBranchId?: string;
  customerId?: string;
  customer?: { id: string; name: string } | null;
  fromBranch?: { id: string; name?: string; shortCode: string } | null;
  toBranch?: { id: string; name?: string; shortCode: string } | null;
};

const LOOKUP_SIZE = { size: 1000 } as const;

export type LROption = { value: string; label: string };
export type LRTripOption = LROption & TripRow;
export type LRBranchOption = LROption & { branchCode: string; isRailHead: boolean };

export const lrLookups = {
  vehicles: async (): Promise<(LROption & VehicleRow)[]> => {
    const res = await api.get<ApiResponse<VehicleRow[]>>("/vehicles", {
      params: LOOKUP_SIZE,
    });
    return unwrapListResponse(res).data.map((v) => ({
      ...v,
      value: v.id,
      label: v.vehicleNumber,
    }));
  },

  marketVehicles: async (): Promise<(LROption & VehicleRow)[]> => {
    const res = await api.get<ApiResponse<VehicleRow[]>>("/vehicles", {
      params: { ...LOOKUP_SIZE, "filter[ownershipType]": "Market_Vehicle" },
    });
    return unwrapListResponse(res).data.map((v) => ({
      ...v,
      value: v.id,
      label: v.vehicleNumber,
    }));
  },

  drivers: async (): Promise<(LROption & DriverRow)[]> => {
    const res = await api.get<ApiResponse<DriverRow[]>>("/drivers", {
      params: { ...LOOKUP_SIZE, sort: "name:asc" },
    });
    return unwrapListResponse(res).data.map((d) => ({
      ...d,
      value: d.id,
      label: d.name,
    }));
  },

  customers: async (): Promise<LROption[]> => {
    const res = await api.get<ApiResponse<CustomerRow[]>>("/customers", {
      params: { ...LOOKUP_SIZE, sort: "name:asc" },
    });
    return unwrapListResponse(res).data.map((c) => ({
      value: c.id,
      label: c.shortName ? `${c.name} (${c.shortName})` : c.name,
    }));
  },

  branches: async (): Promise<LRBranchOption[]> => {
    const res = await api.get<ApiResponse<BranchRow[]>>("/branches", {
      params: LOOKUP_SIZE,
    });
    return unwrapListResponse(res).data.map((b) => ({
      value: b.id,
      label: b.name,
      branchCode: b.branchCode,
      isRailHead: b.isRailHead ?? false,
    }));
  },

  railheadBranches: async (): Promise<LRBranchOption[]> => {
    const res = await api.get<ApiResponse<BranchRow[]>>("/branches", {
      params: { ...LOOKUP_SIZE, "filter[isRailHead]": "true" },
    });
    return unwrapListResponse(res).data.map((b) => ({
      value: b.id,
      label: b.name,
      branchCode: b.branchCode,
      isRailHead: true,
    }));
  },

  plannedTrips: async (): Promise<LRTripOption[]> => {
    const res = await api.get<ApiResponse<TripRow[]>>("/vehicle-trips", {
      params: { ...LOOKUP_SIZE, "filter[status]": "Planned" },
    });
    return unwrapListResponse(res).data.map((t) => ({
      ...t,
      value: t.id,
      label: `${t.tripNumber} — ${t.tripName}`,
    }));
  },

  confirmedTruckOrders: async (): Promise<(LROption & OrderRow)[]> => {
    const res = await api.get<ApiResponse<OrderRow[]>>("/orders", {
      params: {
        ...LOOKUP_SIZE,
        "filter[status]": "Confirmed",
        "filter[orderType]": "Truck",
      },
    });
    return unwrapListResponse(res).data.map((o) => ({
      ...o,
      value: o.id,
      label: o.orderNumber,
    }));
  },
};

export const lrLookupKeys = {
  vehicles: ["lookup", "vehicles"] as const,
  marketVehicles: ["lookup", "market-vehicles"] as const,
  drivers: ["lookup", "drivers"] as const,
  customers: ["lookup", "customers"] as const,
  branches: ["lookup", "branches"] as const,
  railheadBranches: ["lookup", "railhead-branches"] as const,
  plannedTrips: ["lookup", "planned-trips"] as const,
  confirmedTruckOrders: ["lookup", "confirmed-truck-orders"] as const,
};
