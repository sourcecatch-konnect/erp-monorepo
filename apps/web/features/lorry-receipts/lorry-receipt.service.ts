import { api } from "@/lib/api";
import type {
  ApiResponse,
  LorryReceipt,
  LRListItem,
  UpdateLRBody,
  AddEwayBillBody,
  EwayBill,
  LRDelivery,
  LRAcknowledgement,
  DeliverLRFormInput,
  AcknowledgeLRFormInput,
} from "@skerp/types";
import {
  type ListQuery,
  type ListResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../masters/_shared/master-api";

/**
 * LR-level API. An LR is a single consignment within an LRGroup — creation,
 * finalise, hub-split and cancel are group-level actions (see lr-group.service).
 * This service is read + the per-LR draft edits and extra e-way bills.
 */
export const lorryReceiptApi = {
  list: async (query?: ListQuery): Promise<ListResult<LRListItem>> => {
    const params: Record<string, string | number> = {};
    if (query?.page !== undefined) params.page = query.page;
    if (query?.size !== undefined) params.size = query.size;
    if (query?.search) params.search = query.search;
    if (query?.sort) params.sort = query.sort;
    if (query?.filter?.status)
      params["filter[status]"] = String(query.filter.status);
    if (query?.filter?.groupId)
      params["filter[groupId]"] = String(query.filter.groupId);
    const res = await api.get<ApiResponse<LRListItem[]>>("/lorry-receipts", {
      params,
    });
    return unwrapListResponse(res);
  },

  detail: async (id: string): Promise<LorryReceipt> => {
    const res = await api.get<ApiResponse<LorryReceipt>>(
      `/lorry-receipts/${id}`,
    );
    return unwrapApiResponse(res);
  },

  update: async (
    id: string,
    body: UpdateLRBody & { version?: number },
  ): Promise<LorryReceipt> => {
    const res = await api.patch<ApiResponse<LorryReceipt>>(
      `/lorry-receipts/${id}`,
      body,
    );
    return unwrapApiResponse(res);
  },

  addEwayBill: async (id: string, body: AddEwayBillBody): Promise<EwayBill> => {
    const res = await api.post<ApiResponse<EwayBill>>(
      `/lorry-receipts/${id}/eway-bills`,
      body,
    );
    return unwrapApiResponse(res);
  },

  remove: async (id: string): Promise<{ id: string }> => {
    const res = await api.delete<ApiResponse<{ id: string }>>(`/lorry-receipts/${id}`);
    return unwrapApiResponse(res);
  },

  /* ---- delivery / acknowledgement (docs/LR_DELIVERY_ACK_PLAN.md) ---- */

  deliver: async (id: string, body: DeliverLRFormInput): Promise<LRDelivery> => {
    const res = await api.post<ApiResponse<LRDelivery>>(
      `/lorry-receipts/${id}/deliver`,
      body,
    );
    return unwrapApiResponse(res);
  },

  updateDelivery: async (
    id: string,
    body: DeliverLRFormInput,
  ): Promise<LRDelivery> => {
    const res = await api.patch<ApiResponse<LRDelivery>>(
      `/lorry-receipts/${id}/delivery`,
      body,
    );
    return unwrapApiResponse(res);
  },

  undoDelivery: async (id: string): Promise<{ id: string }> => {
    const res = await api.post<ApiResponse<{ id: string }>>(
      `/lorry-receipts/${id}/undo-delivery`,
    );
    return unwrapApiResponse(res);
  },

  acknowledge: async (
    id: string,
    body: AcknowledgeLRFormInput,
  ): Promise<LRAcknowledgement> => {
    const res = await api.post<ApiResponse<LRAcknowledgement>>(
      `/lorry-receipts/${id}/acknowledge`,
      body,
    );
    return unwrapApiResponse(res);
  },

  updateAcknowledgement: async (
    id: string,
    body: AcknowledgeLRFormInput,
  ): Promise<LRAcknowledgement> => {
    const res = await api.patch<ApiResponse<LRAcknowledgement>>(
      `/lorry-receipts/${id}/acknowledgement`,
      body,
    );
    return unwrapApiResponse(res);
  },

  undoAcknowledgement: async (id: string): Promise<{ id: string }> => {
    const res = await api.post<ApiResponse<{ id: string }>>(
      `/lorry-receipts/${id}/undo-acknowledgement`,
    );
    return unwrapApiResponse(res);
  },
};

/* ------------------------------------------------------------------ */
/* Lookup helpers (reused across LR form)                             */
/* ------------------------------------------------------------------ */

type VehicleRow = {
  id: string;
  vehicleNumber: string;
  ownershipType?: string;
  isAssigned?: boolean;
  activeGroupNumber?: string | null;
};

type DriverRow = {
  id: string;
  name: string;
  mobile?: string | null;
  isAssigned?: boolean;
  activeGroupNumber?: string | null;
};
type CustomerRow = { id: string; name: string; shortName: string | null };
type GoodsRow = {
  id: string;
  name: string;
  description?: string | null;
  weight?: number | null;
};
type BranchRow = {
  id: string;
  name: string;
  branchCode: string;
  shortCode?: string;
  isRailHead?: boolean;
  isHeadOffice?: boolean;
};
type TripRow = {
  id: string;
  tripNumber: string;
  tripName: string;
  status: string;
  vehicle?: { id: string; vehicleNumber: string } | null;
  driver?: { id: string; name: string } | null;
  route?: {
    id: string;
    sourceCity?: { id: string; name: string } | null;
    destinationCity?: { id: string; name: string } | null;
  } | null;
  consignor?: { id: string; name: string } | null;
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
  route?: {
  id: string;
  sourceCity?: { id: string; name: string } | null;
  destinationCity?: { id: string; name: string } | null;
} | null;
  customer?: { id: string; name: string } | null;
fromBranch?: { id: string; name?: string; branchCode: string } | null;
toBranch?: { id: string; name?: string; branchCode: string } | null;
};

/** Slim shape of GET /orders/:id we read for FROM_ORDER LR context. */
type OrderContextRow = {
  orderNumber: string;
  status?: string | null;
  truckQuantity?: number | null;
  bookingFreightAmount?: string | number | null;
  customer?: { id: string; name: string } | null;
  consignee?: { id: string; name: string } | null;
fromBranch?: { id: string; name: string; branchCode: string } | null;
toBranch?: { id: string; name: string; branchCode: string } | null;
  route?: {
    sourceCity?: { id: string; name: string } | null;
    destinationCity?: { id: string; name: string } | null;
  } | null;
  consignments?: {
    truckIndex: number;
    totalWeight?: string | number | null;
    loadingLocation?: { id: string; name: string } | null;
    unloadingLocation?: { id: string; name: string } | null;
    goods?: {
      quantity: number;
      unit: string;
      goods?: { id: string; name: string } | null;
    }[];
  }[];
};

/** One consignment line as the LR create summary renders it. */
export type LROrderContextLine = {
  truckIndex: number;
  totalWeight: number | null;
  loadingLocation: string | null;
  unloadingLocation: string | null;
  goods: { name: string; quantity: number; unit: string }[];
};

/** Order context that drives the truck selector + LR create summary panel. */
export type LROrderContext = {
  orderNumber: string;
  status: string | null;
  truckQuantity: number | null;
  bookingFreightAmount: number | null;
  consignor: string | null;
  consignorId: string | null;
  consignee: string | null;
  fromBranch: { name: string; branchCode: string } | null;
toBranch: { name: string; branchCode: string } | null;
  route: { source: string | null; destination: string | null } | null;
  trucks: { truckIndex: number; lineCount: number }[];
  lines: LROrderContextLine[];
};

const LOOKUP_SIZE = { size: 1000 } as const;

export type LROption = { value: string; label: string };
export type LRTripOption = LROption &
  TripRow & { hint?: string; badge?: string };
export type LRBranchOption = LROption & {
  branchCode: string;
  isRailHead: boolean;
  isHeadOffice: boolean;
};

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

  goods: async (): Promise<(LROption & GoodsRow)[]> => {
    const res = await api.get<ApiResponse<GoodsRow[]>>("/goods", {
      params: { ...LOOKUP_SIZE, sort: "name:asc" },
    });
    return unwrapListResponse(res).data.map((g) => ({
      ...g,
      value: g.id,
      label: g.name,
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
      isHeadOffice: b.isHeadOffice ?? false,
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
      isHeadOffice: b.isHeadOffice ?? false,
    }));
  },

  /**
   * Trips an LR can attach to: any non-cancelled trip with no live LR on it.
   * When `consignorId` is given, only trips for that consignor are returned —
   * a trip carries one client, so it can only serve an LR for that same client.
   */
  attachableTrips: async (consignorId?: string): Promise<LRTripOption[]> => {
    const res = await api.get<ApiResponse<TripRow[]>>("/trips", {
      params: {
        ...LOOKUP_SIZE,
        "filter[unattached]": "true",
        ...(consignorId ? { "filter[consignorId]": consignorId } : {}),
      },
    });
    const statusLabel: Record<string, string> = {
      Planned: "Planned",
      InTransit: "In Transit",
      Closed: "Closed",
    };
    return unwrapListResponse(res).data.map((t) => {
      const from = t.route?.sourceCity?.name;
      const to = t.route?.destinationCity?.name;
      return {
        ...t,
        value: t.id,
        label: t.tripName,
        hint: from && to ? `${from} → ${to}` : t.tripNumber,
        badge: statusLabel[t.status] ?? t.status,
      };
    });
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

  customerLocations: async (customerId: string): Promise<LROption[]> => {
    const res = await api.get<ApiResponse<{ id: string; name: string }[]>>(
      `/customers/${customerId}/locations`,
    );
    return unwrapApiResponse(res).map((l) => ({ value: l.id, label: l.name }));
  },

  /**
   * Context for a FROM_ORDER LR group: the order's parties, route, freight, and
   * its consignment lines grouped per truck. Drives both the truck selector
   * (offer only trucks that actually have lines, with counts) and the create
   * summary panel (show exactly what will be generated for the chosen truck).
   */
  orderContext: async (orderId: string): Promise<LROrderContext> => {
    const res = await api.get<ApiResponse<OrderContextRow>>(
      `/orders/${orderId}`,
    );
    const order = unwrapApiResponse(res);

    const lines: LROrderContextLine[] = (order.consignments ?? []).map((c) => ({
      truckIndex: c.truckIndex,
      totalWeight:
        c.totalWeight != null && !Number.isNaN(Number(c.totalWeight))
          ? Number(c.totalWeight)
          : null,
      loadingLocation: c.loadingLocation?.name ?? null,
      unloadingLocation: c.unloadingLocation?.name ?? null,
      goods: (c.goods ?? []).map((g) => ({
        name: g.goods?.name ?? "—",
        quantity: g.quantity,
        unit: g.unit,
      })),
    }));

    const counts = new Map<number, number>();
    for (const l of lines) counts.set(l.truckIndex, (counts.get(l.truckIndex) ?? 0) + 1);
    const trucks = [...counts.entries()]
      .map(([truckIndex, lineCount]) => ({ truckIndex, lineCount }))
      .sort((a, b) => a.truckIndex - b.truckIndex);

    return {
      orderNumber: order.orderNumber,
      status: order.status ?? null,
      truckQuantity: order.truckQuantity ?? null,
      bookingFreightAmount:
        order.bookingFreightAmount != null
          ? Number(order.bookingFreightAmount)
          : null,
      consignor: order.customer?.name ?? null,
      consignorId: order.customer?.id ?? null,
      consignee: order.consignee?.name ?? null,
      fromBranch: order.fromBranch
  ? { name: order.fromBranch.name, branchCode: order.fromBranch.branchCode }
  : null,
toBranch: order.toBranch
  ? { name: order.toBranch.name, branchCode: order.toBranch.branchCode }
  : null,
      route: order.route
        ? {
            source: order.route.sourceCity?.name ?? null,
            destination: order.route.destinationCity?.name ?? null,
          }
        : null,
      trucks,
      lines,
    };
  },
};

export const lrLookupKeys = {
  vehicles: ["lookup", "vehicles"] as const,
  marketVehicles: ["lookup", "market-vehicles"] as const,
  drivers: ["lookup", "drivers"] as const,
  customers: ["lookup", "customers"] as const,
  goods: ["lookup", "goods"] as const,
  branches: ["lookup", "branches"] as const,
  railheadBranches: ["lookup", "railhead-branches"] as const,
  attachableTrips: (consignorId?: string) =>
    ["lookup", "attachable-trips", consignorId ?? "all"] as const,
  confirmedTruckOrders: ["lookup", "confirmed-truck-orders"] as const,
  customerLocations: (customerId: string) =>
    ["lookup", "customer-locations", customerId] as const,
  orderContext: (orderId: string) =>
    ["lookup", "order-context", orderId] as const,
};
