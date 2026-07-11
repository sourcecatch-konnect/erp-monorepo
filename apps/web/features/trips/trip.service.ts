import { api } from "@/lib/api";
import type {
  ApiResponse,
  Trip,
  CreateTripBody,
  UpdateTripBody,
  CloseTripBody,
  CancelTripBody,
  ActiveJourneyInfo,
} from "@skerp/types";
import {
  ListQuery,
  ListResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../masters/_shared/master-api";

/**
 * `fields` narrows the relations the server joins to the visible table
 * columns (comma-separated column ids). Omit it to fetch everything.
 */
export type TripListQuery = ListQuery & { fields?: string };

export const tripApi = {
  list: async (query?: TripListQuery): Promise<ListResult<Trip>> => {
    const params: Record<string, string | number> = {};
    if (query?.page !== undefined) params.page = query.page;
    if (query?.size !== undefined) params.size = query.size;
    if (query?.search) params.search = query.search;
    if (query?.sort) params.sort = query.sort;
    if (query?.fields) params.fields = query.fields;
    if (query?.filter?.status)
      params["filter[status]"] = String(query.filter.status);
    if (query?.filter?.tripType) {
      params["filter[tripType]"] = String(query.filter.tripType);
    }

    const res = await api.get<ApiResponse<Trip[]>>("/trips", { params });
    return unwrapListResponse(res);
  },

  statusCounts: async (): Promise<Record<string, number>> => {
    const res = await api.get<ApiResponse<Record<string, number>>>(
      "/trips/status-counts",
    );
    return unwrapApiResponse(res);
  },

  detail: async (id: string): Promise<Trip> => {
    const res = await api.get<ApiResponse<Trip>>(`/trips/${id}`);
    return unwrapApiResponse(res);
  },

  create: async (body: CreateTripBody): Promise<Trip> => {
    const res = await api.post<ApiResponse<Trip>>("/trips", body);
    return unwrapApiResponse(res);
  },

  update: async (
    id: string,
    body: UpdateTripBody & { version?: number },
  ): Promise<Trip> => {
    const res = await api.patch<ApiResponse<Trip>>(`/trips/${id}`, body);
    return unwrapApiResponse(res);
  },

  dispatch: async (id: string): Promise<Trip> => {
    const res = await api.post<ApiResponse<Trip>>(`/trips/${id}/dispatch`, {});
    return unwrapApiResponse(res);
  },

  close: async (id: string, body: CloseTripBody): Promise<Trip> => {
    const res = await api.post<ApiResponse<Trip>>(`/trips/${id}/close`, body);
    return unwrapApiResponse(res);
  },

  cancel: async (id: string, body: CancelTripBody): Promise<Trip> => {
    const res = await api.post<ApiResponse<Trip>>(`/trips/${id}/cancel`, body);
    return unwrapApiResponse(res);
  },

  delete: async (id: string): Promise<Trip> => {
    const res = await api.delete<ApiResponse<Trip>>(`/trips/${id}`);
    return unwrapApiResponse(res);
  },

  downloadPdf: async (id: string): Promise<Blob> => {
    const res = await api.get<Blob>(`/trips/${encodeURIComponent(id)}/pdf`, {
      responseType: "blob",
    });
    return res.data;
  },

  /**
   * Journey context for the trip form: the vehicle's active journey (chain
   * tip, locked driver) plus the head-office base a new journey starts from.
   */
  activeJourney: async (vehicleId: string): Promise<ActiveJourneyInfo> => {
    const res = await api.get<ApiResponse<ActiveJourneyInfo>>(
      "/vehicle-journeys/active",
      { params: { vehicleId } },
    );
    return unwrapApiResponse(res);
  },
};

/* ------------------------------------------------------------------ */
/* Lookups for the trip form (reuse master list endpoints)            */
/* ------------------------------------------------------------------ */

type VehicleRow = {
  id: string;
  vehicleNumber: string;
  ownershipType: string;
};
type DriverRow = { id: string; name: string };
type CustomerRow = { id: string; name: string };
type RouteRow = {
  id: string;
  sourceCity?: { id: string; name: string } | null;
  destinationCity?: { id: string; name: string } | null;
};

const LOOKUP_QUERY = { size: 1000 } as const;

export type TripOption = { value: string; label: string };
/** Routes carry their city ids so the form can pre-check chain continuity. */
export type TripRouteOption = TripOption & {
  sourceCityId: string | null;
  sourceCityName: string | null;
  destinationCityId: string | null;
};

export const tripLookups = {
  // Trips run on our own vehicles only.
  ownVehicles: async (): Promise<TripOption[]> => {
    const res = await api.get<ApiResponse<VehicleRow[]>>("/vehicles", {
      params: LOOKUP_QUERY,
    });
    return unwrapListResponse(res)
      .data.filter((v) => v.ownershipType === "Own_Vehicle")
      .map((v) => ({ value: v.id, label: v.vehicleNumber }));
  },
  drivers: async (): Promise<TripOption[]> => {
    const res = await api.get<ApiResponse<DriverRow[]>>("/drivers", {
      params: { ...LOOKUP_QUERY, sort: "name:asc" },
    });
    return unwrapListResponse(res).data.map((d) => ({
      value: d.id,
      label: d.name,
    }));
  },
  routes: async (): Promise<TripRouteOption[]> => {
    const res = await api.get<ApiResponse<RouteRow[]>>("/routes", {
      params: LOOKUP_QUERY,
    });
    return unwrapListResponse(res).data.map((r) => ({
      value: r.id,
      label: `${r.sourceCity?.name ?? "?"} → ${r.destinationCity?.name ?? "?"}`,
      sourceCityId: r.sourceCity?.id ?? null,
      sourceCityName: r.sourceCity?.name ?? null,
      destinationCityId: r.destinationCity?.id ?? null,
    }));
  },
  customers: async (): Promise<TripOption[]> => {
    const res = await api.get<ApiResponse<CustomerRow[]>>("/customers", {
      params: { ...LOOKUP_QUERY, sort: "name:asc" },
    });
    return unwrapListResponse(res).data.map((c) => ({
      value: c.id,
      label: c.name,
    }));
  },
};

export const tripLookupKeys = {
  ownVehicles: ["lookup", "own-vehicles"] as const,
  drivers: ["lookup", "drivers"] as const,
  routes: ["lookup", "trip-routes"] as const,
  customers: ["lookup", "customers"] as const,
  activeJourney: (vehicleId: string) =>
    ["trips", "active-journey", vehicleId] as const,
};
