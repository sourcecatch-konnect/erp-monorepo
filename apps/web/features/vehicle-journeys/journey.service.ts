import { api } from "@/lib/api";
import type {
  ApiResponse,
  VehicleJourney,
  JourneyLeg,
  TripExpense,
  TripExpenseType,
  DriverAdvance,
  LogSlip,
  LogSlipPreview,
  VehicleJourneyStatus,
  JourneySettlementStatus,
  StartJourneyBody,
  AddJourneyLegBody,
  CloseJourneyLegBody,
  DispatchJourneyLegBody,
  CancelJourneyBody,
  CloseJourneyBody,
  ReopenSettlementReviewBody,
  TripExpenseFormInput,
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

export type JourneyCreateResult = Pick<VehicleJourney, "id" | "journeyNumber">;
export type JourneyStatusResult = Pick<VehicleJourney, "id" | "status" | "version">;

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
      params["filter[settlementStatus]"] = String(
        query.filter.settlementStatus,
      );
    if (query?.filter?.startedFrom)
      params["filter[startedFrom]"] = String(query.filter.startedFrom);
    if (query?.filter?.startedTo)
      params["filter[startedTo]"] = String(query.filter.startedTo);

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

  downloadReportPdf: async (id: string): Promise<Blob> => {
    const res = await api.get<Blob>(
      `/vehicle-journeys/${encodeURIComponent(id)}/report-pdf`,
      { responseType: "blob" },
    );
    return res.data;
  },

  start: async (body: StartJourneyBody): Promise<JourneyCreateResult> => {
    const res = await api.post<ApiResponse<JourneyCreateResult>>(
      "/vehicle-journeys",
      body,
    );
    return unwrapApiResponse(res);
  },

  addLeg: async (id: string, body: AddJourneyLegBody): Promise<JourneyLeg> => {
    const res = await api.post<ApiResponse<JourneyLeg>>(
      `/vehicle-journeys/${id}/add-leg`,
      body,
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
  ): Promise<JourneyStatusResult> => {
    const res = await api.post<ApiResponse<JourneyStatusResult>>(
      `/vehicle-journeys/${id}/close-leg/${tripId}`,
      body,
    );
    return unwrapApiResponse(res);
  },

  markReady: async (id: string): Promise<JourneyStatusResult> => {
    const res = await api.post<ApiResponse<JourneyStatusResult>>(
      `/vehicle-journeys/${id}/mark-ready-for-log-slip`,
      {},
    );
    return unwrapApiResponse(res);
  },

  reopenSettlementReview: async (
    id: string,
    body: ReopenSettlementReviewBody,
  ): Promise<JourneyStatusResult> => {
    const res = await api.post<ApiResponse<JourneyStatusResult>>(
      `/vehicle-journeys/${id}/reopen-settlement-review`,
      body,
    );
    return unwrapApiResponse(res);
  },

  forceClose: async (
    id: string,
    body: CloseJourneyBody,
  ): Promise<JourneyStatusResult> => {
    const res = await api.post<ApiResponse<JourneyStatusResult>>(
      `/vehicle-journeys/${id}/close`,
      body,
    );
    return unwrapApiResponse(res);
  },

  cancel: async (
    id: string,
    body: CancelJourneyBody,
  ): Promise<JourneyStatusResult> => {
    const res = await api.post<ApiResponse<JourneyStatusResult>>(
      `/vehicle-journeys/${id}/cancel`,
      body,
    );
    return unwrapApiResponse(res);
  },
};

export const expenseApi = {
  // The wire accepts rupees; the server schema validates and converts to paise.
  create: async (body: TripExpenseFormInput): Promise<TripExpense> => {
    const res = await api.post<ApiResponse<TripExpense>>(
      "/trip-expenses",
      body,
    );
    return unwrapApiResponse(res);
  },
  update: async (
    id: string,
    body: TripExpenseFormInput,
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

export const expenseTypeApi = {
  list: async (): Promise<TripExpenseType[]> => {
    const res = await api.get<ApiResponse<TripExpenseType[]>>(
      "/trip-expense-types",
    );
    return unwrapApiResponse(res);
  },
  create: async (name: string): Promise<TripExpenseType> => {
    const res = await api.post<ApiResponse<TripExpenseType>>(
      "/trip-expense-types",
      { name },
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

type VehicleRow = {
  id: string;
  vehicleNumber: string;
  ownershipType: string;
  currentKM?: number | null;
};
type NamedRow = { id: string; name: string };
type BranchRow = { id: string; name: string; branchCode: string };
type RouteRow = {
  id: string;
  sourceCity?: { id: string; name: string } | null;
  destinationCity?: { id: string; name: string } | null;
};
type CashAccountRow = { id: string; name: string; isActive?: boolean };

const LOOKUP_QUERY = { size: 1000 } as const;

export type JourneyOption = { value: string; label: string };
export type JourneyVehicleOption = JourneyOption & {
  /** Odometer reading — a journey's opening KM can't be below it. */
  currentKM: number | null;
};
export type JourneyRouteOption = JourneyOption & {
  sourceCityId: string | null;
  destinationCityId: string | null;
};

export const journeyLookups = {
  // Journeys run on our own vehicles only.
  ownVehicles: async (): Promise<JourneyVehicleOption[]> => {
    const res = await api.get<ApiResponse<VehicleRow[]>>("/vehicles", {
      params: LOOKUP_QUERY,
    });
    return unwrapListResponse(res)
      .data.filter((v) => v.ownershipType === "Own_Vehicle")
      .map((v) => ({
        value: v.id,
        label: v.vehicleNumber,
        currentKM: v.currentKM ?? null,
      }));
  },
  // Routes carry their city ids so dialogs can pre-check chain continuity.
  routes: async (): Promise<JourneyRouteOption[]> => {
    const res = await api.get<ApiResponse<RouteRow[]>>("/routes", {
      params: LOOKUP_QUERY,
    });
    return unwrapListResponse(res).data.map((r) => ({
      value: r.id,
      label: `${r.sourceCity?.name ?? "?"} → ${r.destinationCity?.name ?? "?"}`,
      sourceCityId: r.sourceCity?.id ?? null,
      destinationCityId: r.destinationCity?.id ?? null,
    }));
  },
  customers: async (): Promise<JourneyOption[]> => {
    const res = await api.get<ApiResponse<NamedRow[]>>("/customers", {
      params: { ...LOOKUP_QUERY, sort: "name:asc" },
    });
    return unwrapListResponse(res).data.map((c) => ({
      value: c.id,
      label: c.name,
    }));
  },
  cities: async (): Promise<JourneyOption[]> => {
    const res = await api.get<ApiResponse<NamedRow[]>>("/cities", {
      params: { ...LOOKUP_QUERY, sort: "name:asc" },
    });
    return unwrapListResponse(res).data.map((c) => ({
      value: c.id,
      label: c.name,
    }));
  },
  branches: async (): Promise<(JourneyOption & { branchCode: string })[]> => {
    const res = await api.get<ApiResponse<BranchRow[]>>("/branches", {
      params: LOOKUP_QUERY,
    });
    return unwrapListResponse(res).data.map((b) => ({
      value: b.id,
      label: b.name,
      branchCode: b.branchCode,
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
