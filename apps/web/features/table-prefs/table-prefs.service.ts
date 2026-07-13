import { api } from "@/lib/api";
import type { ApiResponse, TablePrefData } from "@skerp/types";
import { unwrapApiResponse } from "../masters/_shared/master-api";

export const tablePrefApi = {
  get: async (tableKey: string): Promise<TablePrefData | null> => {
    const res = await api.get<ApiResponse<TablePrefData | null>>(
      `/me/table-prefs/${encodeURIComponent(tableKey)}`,
    );
    return unwrapApiResponse(res);
  },

  save: async (
    tableKey: string,
    prefs: TablePrefData,
  ): Promise<TablePrefData> => {
    const res = await api.put<ApiResponse<TablePrefData>>(
      `/me/table-prefs/${encodeURIComponent(tableKey)}`,
      prefs,
    );
    return unwrapApiResponse(res);
  },
};

export const tablePrefKeys = {
  pref: (tableKey: string) => ["table-prefs", tableKey] as const,
};
