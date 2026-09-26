import { api } from "@/lib/api";
import type { ApiResponse } from "@skerp/types";
import { unwrapApiResponse } from "../masters/_shared/master-api";

/** All money is paise carried as digit strings (JSON has no BigInt). */
export type FixedCosts = {
  taxPaise: string;
  insurancePaise: string;
  permitPaise: string;
  fitnessPaise: string;
  emiPaise: string;
};

export type MonthlyCosts = FixedCosts & {
  salaryPaise: string;
  tyrePaise: string;
  otherPaise: string;
};

export type VehicleCostRow = MonthlyCosts & {
  vehicleId: string;
  vehicleNumber: string;
  hasMonthlyRow: boolean;
  remarks: string | null;
  defaults: FixedCosts;
};

export type MonthlyPnlRow = {
  vehicleId: string;
  vehicleNumber: string;
  periodFrom: string | null;
  periodTo: string | null;
  trips: number;
  days: number;
  km: number;
  freightPaise: string;
  dieselPaise: string;
  otherExpensePaise: string;
  totalExpensePaise: string;
  tripBalancePaise: string;
  taxPaise: string;
  insurancePaise: string;
  permitPaise: string;
  fitnessPaise: string;
  emiPaise: string;
  salaryPaise: string;
  fixedTotalPaise: string;
  repairsPaise: string;
  tyrePaise: string;
  otherCostPaise: string;
  variableTotalPaise: string;
  resultPaise: string;
  hasMonthlyCostRow: boolean;
  slips: { logSlipId: string; journeyId: string; logSlipNumber: string | null }[];
};

export type MonthlyPnlTotals = {
  vehicleCount: number;
  profitVehicleCount: number;
  lossVehicleCount: number;
  profitAmountPaise: string;
  lossAmountPaise: string;
  netPaise: string;
  freightPaise: string;
  fixedTotalPaise: string;
  variableTotalPaise: string;
};

export type MonthlyPnlResult = {
  month: string;
  rows: MonthlyPnlRow[];
  totals: MonthlyPnlTotals;
};

export const vehicleCostApi = {
  list: async (month: string): Promise<VehicleCostRow[]> => {
    const res = await api.get<ApiResponse<VehicleCostRow[]>>("/vehicle-costs", {
      params: { month },
    });
    return unwrapApiResponse(res);
  },

  saveMonth: async (
    vehicleId: string,
    month: string,
    body: MonthlyCosts & { remarks?: string | null },
  ) => {
    const res = await api.put<ApiResponse<{ id: string }>>(
      `/vehicle-costs/${vehicleId}/${month}`,
      body,
    );
    return unwrapApiResponse(res);
  },

  resetMonth: async (vehicleId: string, month: string) => {
    const res = await api.delete<ApiResponse<unknown>>(
      `/vehicle-costs/${vehicleId}/${month}`,
    );
    return unwrapApiResponse(res);
  },

  saveDefaults: async (vehicleId: string, body: FixedCosts) => {
    const res = await api.put<ApiResponse<unknown>>(
      `/vehicle-costs/defaults/${vehicleId}`,
      body,
    );
    return unwrapApiResponse(res);
  },

  monthlyPnl: async (month: string): Promise<MonthlyPnlResult> => {
    const res = await api.get<ApiResponse<MonthlyPnlResult>>(
      "/log-slips/vehicle-pnl/monthly",
      { params: { month } },
    );
    return unwrapApiResponse(res);
  },
};

/** "2026-08" for today, in local time — the default month for the pages. */
export const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

/** Rupees typed by a user ("1,395.50") → paise digit string. Blank → "0". */
export const rupeesToPaise = (input: string): string => {
  const cleaned = input.replace(/,/g, "").trim();
  if (!cleaned) return "0";
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) throw new Error("Enter a valid amount");
  return String(Math.round(value * 100));
};

/** Paise digit string → editable rupee text ("" for zero). */
export const paiseToInput = (paise: string): string => {
  if (paise === "0") return "";
  const rupees = Number(paise) / 100;
  return Number.isInteger(rupees) ? String(rupees) : rupees.toFixed(2);
};
