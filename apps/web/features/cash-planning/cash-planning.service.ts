import { api } from "@/lib/api";
import type {
  ApiResponse,
  CashPlanDayView,
  CashPayment,
  CreateCashPaymentBody,
  UpdateCashPaymentBody,
  UpsertCashBalancesBody,
  PaymentStatus,
  CreditorLedgerView,
  CreateCashReceivableBody,
  UpdateCashReceivableBody,
} from "@skerp/types";
import { unwrapApiResponse } from "../masters/_shared/master-api";

export type CashDaySummary = {
  id: string;
  date: string;
  status: "OPEN" | "CLOSED";
  closedAt: string | null;
};

export const cashPlanningApi = {
  /** Returns the day's full view, or null if no plan exists for that date. */
  getDay: async (date: string): Promise<CashPlanDayView | null> => {
    const res = await api.get<ApiResponse<CashPlanDayView | null>>(
      `/cash-planning/days/${date}`,
    );
    return unwrapApiResponse(res);
  },

  listDays: async (): Promise<CashDaySummary[]> => {
    const res = await api.get<ApiResponse<CashDaySummary[]>>(
      "/cash-planning/days",
    );
    return unwrapApiResponse(res);
  },

  openDay: async (date: string): Promise<CashPlanDayView> => {
    const res = await api.post<ApiResponse<CashPlanDayView>>(
      "/cash-planning/days",
      { date },
    );
    return unwrapApiResponse(res);
  },

  upsertBalances: async (
    dayId: string,
    body: UpsertCashBalancesBody,
  ): Promise<CashPlanDayView> => {
    const res = await api.put<ApiResponse<CashPlanDayView>>(
      `/cash-planning/days/${dayId}/balances`,
      body,
    );
    return unwrapApiResponse(res);
  },

  addPayment: async (
    dayId: string,
    body: CreateCashPaymentBody,
  ): Promise<{ payment: CashPayment; day: CashPlanDayView }> => {
    const res = await api.post<
      ApiResponse<{ payment: CashPayment; day: CashPlanDayView }>
    >(`/cash-planning/days/${dayId}/payments`, body);
    return unwrapApiResponse(res);
  },

  updatePayment: async (
    id: string,
    body: UpdateCashPaymentBody,
  ): Promise<CashPlanDayView> => {
    const res = await api.patch<ApiResponse<CashPlanDayView>>(
      `/cash-planning/payments/${id}`,
      body,
    );
    return unwrapApiResponse(res);
  },

  deletePayment: async (id: string): Promise<CashPlanDayView> => {
    const res = await api.delete<ApiResponse<CashPlanDayView>>(
      `/cash-planning/payments/${id}`,
    );
    return unwrapApiResponse(res);
  },

  setStatus: async (
    id: string,
    status: PaymentStatus,
    note?: string,
  ): Promise<CashPlanDayView> => {
    const res = await api.post<ApiResponse<CashPlanDayView>>(
      `/cash-planning/payments/${id}/status`,
      { status, note },
    );
    return unwrapApiResponse(res);
  },

  reorder: async (
    dayId: string,
    orderedIds: string[],
  ): Promise<CashPlanDayView> => {
    const res = await api.put<ApiResponse<CashPlanDayView>>(
      `/cash-planning/days/${dayId}/payments/reorder`,
      { orderedIds },
    );
    return unwrapApiResponse(res);
  },

  closeDay: async (dayId: string): Promise<CashPlanDayView> => {
    const res = await api.post<ApiResponse<CashPlanDayView>>(
      `/cash-planning/days/${dayId}/close`,
      { confirm: true },
    );
    return unwrapApiResponse(res);
  },

  // ── receivables ──
  addReceivable: async (
    dayId: string,
    body: CreateCashReceivableBody,
  ): Promise<CashPlanDayView> => {
    const res = await api.post<ApiResponse<CashPlanDayView>>(
      `/cash-planning/days/${dayId}/receivables`,
      body,
    );
    return unwrapApiResponse(res);
  },

  updateReceivable: async (
    id: string,
    body: UpdateCashReceivableBody,
  ): Promise<CashPlanDayView> => {
    const res = await api.patch<ApiResponse<CashPlanDayView>>(
      `/cash-planning/receivables/${id}`,
      body,
    );
    return unwrapApiResponse(res);
  },

  markReceived: async (
    id: string,
    receivedAmount: number,
  ): Promise<CashPlanDayView> => {
    const res = await api.post<ApiResponse<CashPlanDayView>>(
      `/cash-planning/receivables/${id}/received`,
      { receivedAmount, ackReceived: true },
    );
    return unwrapApiResponse(res);
  },

  deleteReceivable: async (id: string): Promise<CashPlanDayView> => {
    const res = await api.delete<ApiResponse<CashPlanDayView>>(
      `/cash-planning/receivables/${id}`,
    );
    return unwrapApiResponse(res);
  },

  // ── creditor ledger ──
  ledger: async (): Promise<CreditorLedgerView> => {
    const res = await api.get<ApiResponse<CreditorLedgerView>>(
      "/cash-planning/ledger",
    );
    return unwrapApiResponse(res);
  },
};
