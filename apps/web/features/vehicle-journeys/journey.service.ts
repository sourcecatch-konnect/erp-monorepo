import { api } from "@/lib/api";
import type {
  ApiResponse,
  VehicleJourney,
  JourneyLeg,
  TripExpense,
  DriverAdvance,
  LogSlip,
  LogSlipPreview,
  VehicleJourneyStatus,
  JourneySettlementStatus,
  CloseJourneyLegBody,
  DispatchJourneyLegBody,
  CancelJourneyBody,
  CloseJourneyBody,
  CreateTripExpenseBody,
  UpdateTripExpenseBody,
  CreateDriverAdvanceBody,
  GenerateLogSlipBody,
} from "@skerp/types";
import {
  ListQuery,
  ListResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../masters/_shared/master-api";

/** Preview endpoint returns the live computation plus journey context. */
export type JourneyLogSlipPreview = LogSlipPreview & {
  journeyStatus: VehicleJourneyStatus;
  settlementStatus: JourneySettlementStatus;
  logSlip: { id: string; status: string; logSlipNumber: string | null } | null;
  totalDieselAmountPaise: number;
};

export const journeyApi = {
  list: async (query?: ListQuery): Promise<ListResult<VehicleJourney>> => {
    const params: Record<string, string | number> = {};
    if (query?.page !== undefined) params.page = query.page;
    if (query?.size !== undefined) params.size = query.size;
    if (query?.search) params.search = query.search;
    if (query?.sort) params.sort = query.sort;
    if (query?.filter?.status)
      params["filter[status]"] = String(query.filter.status);
    if (query?.filter?.settlementStatus)
      params["filter[settlementStatus]"] = String(query.filter.settlementStatus);

    const res = await api.get<ApiResponse<VehicleJourney[]>>(
      "/vehicle-journeys",
      { params },
    );
    return unwrapListResponse(res);
  },

  statusCounts: async (): Promise<Record<string, number>> => {
    const res = await api.get<ApiResponse<Record<string, number>>>(
      "/vehicle-journeys/status-counts",
    );
    return unwrapApiResponse(res);
  },

  detail: async (id: string): Promise<VehicleJourney> => {
    const res = await api.get<ApiResponse<VehicleJourney>>(
      `/vehicle-journeys/${id}`,
    );
    return unwrapApiResponse(res);
  },

  dispatchLeg: async (
    id: string,
    tripId: string,
    body: DispatchJourneyLegBody = {},
  ): Promise<JourneyLeg> => {
    const res = await api.post<ApiResponse<JourneyLeg>>(
      `/vehicle-journeys/${id}/dispatch-leg/${tripId}`,
      body,
    );
    return unwrapApiResponse(res);
  },

  closeLeg: async (
    id: string,
    tripId: string,
    body: CloseJourneyLegBody,
  ): Promise<VehicleJourney> => {
    const res = await api.post<ApiResponse<VehicleJourney>>(
      `/vehicle-journeys/${id}/close-leg/${tripId}`,
      body,
    );
    return unwrapApiResponse(res);
  },

  markReady: async (id: string): Promise<VehicleJourney> => {
    const res = await api.post<ApiResponse<VehicleJourney>>(
      `/vehicle-journeys/${id}/mark-ready-for-log-slip`,
      {},
    );
    return unwrapApiResponse(res);
  },

  forceClose: async (
    id: string,
    body: CloseJourneyBody,
  ): Promise<VehicleJourney> => {
    const res = await api.post<ApiResponse<VehicleJourney>>(
      `/vehicle-journeys/${id}/close`,
      body,
    );
    return unwrapApiResponse(res);
  },

  cancel: async (
    id: string,
    body: CancelJourneyBody,
  ): Promise<VehicleJourney> => {
    const res = await api.post<ApiResponse<VehicleJourney>>(
      `/vehicle-journeys/${id}/cancel`,
      body,
    );
    return unwrapApiResponse(res);
  },
};

export const expenseApi = {
  create: async (body: CreateTripExpenseBody): Promise<TripExpense> => {
    const res = await api.post<ApiResponse<TripExpense>>("/trip-expenses", body);
    return unwrapApiResponse(res);
  },
  update: async (
    id: string,
    body: UpdateTripExpenseBody,
  ): Promise<TripExpense> => {
    const res = await api.patch<ApiResponse<TripExpense>>(
      `/trip-expenses/${id}`,
      body,
    );
    return unwrapApiResponse(res);
  },
  delete: async (id: string): Promise<TripExpense> => {
    const res = await api.delete<ApiResponse<TripExpense>>(
      `/trip-expenses/${id}`,
    );
    return unwrapApiResponse(res);
  },
  approve: async (id: string): Promise<TripExpense> => {
    const res = await api.post<ApiResponse<TripExpense>>(
      `/trip-expenses/${id}/approve`,
      {},
    );
    return unwrapApiResponse(res);
  },
  reject: async (id: string, reason: string): Promise<TripExpense> => {
    const res = await api.post<ApiResponse<TripExpense>>(
      `/trip-expenses/${id}/reject`,
      { reason },
    );
    return unwrapApiResponse(res);
  },
  reverse: async (id: string, reason: string): Promise<TripExpense> => {
    const res = await api.post<ApiResponse<TripExpense>>(
      `/trip-expenses/${id}/reverse`,
      { reason },
    );
    return unwrapApiResponse(res);
  },
};

export const advanceApi = {
  create: async (body: CreateDriverAdvanceBody): Promise<DriverAdvance> => {
    const res = await api.post<ApiResponse<DriverAdvance>>(
      "/driver-advances",
      body,
    );
    return unwrapApiResponse(res);
  },
  reverse: async (id: string, reason: string): Promise<DriverAdvance> => {
    const res = await api.post<ApiResponse<DriverAdvance>>(
      `/driver-advances/${id}/reverse`,
      { reason },
    );
    return unwrapApiResponse(res);
  },
};

export const logSlipApi = {
  preview: async (journeyId: string): Promise<JourneyLogSlipPreview> => {
    const res = await api.get<ApiResponse<JourneyLogSlipPreview>>(
      `/log-slips/${journeyId}/preview`,
    );
    return unwrapApiResponse(res);
  },
  detail: async (id: string): Promise<LogSlip> => {
    const res = await api.get<ApiResponse<LogSlip>>(`/log-slips/${id}`);
    return unwrapApiResponse(res);
  },
  generate: async (
    journeyId: string,
    body: GenerateLogSlipBody,
  ): Promise<LogSlip> => {
    const res = await api.post<ApiResponse<LogSlip>>(
      `/log-slips/${journeyId}/generate`,
      body,
    );
    return unwrapApiResponse(res);
  },
  postAccounts: async (id: string): Promise<LogSlip> => {
    const res = await api.post<ApiResponse<LogSlip>>(
      `/log-slips/${id}/post-accounts`,
      {},
    );
    return unwrapApiResponse(res);
  },
  reopen: async (id: string, reason: string): Promise<LogSlip> => {
    const res = await api.post<ApiResponse<LogSlip>>(
      `/log-slips/${id}/reopen`,
      { reason },
    );
    return unwrapApiResponse(res);
  },
  downloadPdf: async (id: string): Promise<Blob> => {
    const res = await api.get<Blob>(
      `/log-slips/${encodeURIComponent(id)}/pdf`,
      { responseType: "blob" },
    );
    return res.data;
  },
};

/* ------------------------------------------------------------------ */
/* Lookups (reuse master list endpoints)                              */
/* ------------------------------------------------------------------ */

type NamedRow = { id: string; name: string };
type CashAccountRow = { id: string; name: string; isActive?: boolean };

const LOOKUP_QUERY = { size: 1000 } as const;

export type JourneyOption = { value: string; label: string };

export const journeyLookups = {
  cities: async (): Promise<JourneyOption[]> => {
    const res = await api.get<ApiResponse<NamedRow[]>>("/cities", {
      params: { ...LOOKUP_QUERY, sort: "name:asc" },
    });
    return unwrapListResponse(res).data.map((c) => ({
      value: c.id,
      label: c.name,
    }));
  },
  pumps: async (): Promise<JourneyOption[]> => {
    const res = await api.get<ApiResponse<NamedRow[]>>("/pumps", {
      params: { ...LOOKUP_QUERY, sort: "name:asc" },
    });
    return unwrapListResponse(res).data.map((p) => ({
      value: p.id,
      label: p.name,
    }));
  },
  cashAccounts: async (): Promise<JourneyOption[]> => {
    const res = await api.get<ApiResponse<CashAccountRow[]>>("/cash-accounts", {
      params: LOOKUP_QUERY,
    });
    return unwrapListResponse(res).data.map((a) => ({
      value: a.id,
      label: a.name,
    }));
  },
};
