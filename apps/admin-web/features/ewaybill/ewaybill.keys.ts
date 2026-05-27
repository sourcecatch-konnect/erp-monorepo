import type { EwbListFilters } from "./types";

export const ewbKeys = {
  all: ["ewaybills"] as const,
  summary: () => [...ewbKeys.all, "summary"] as const,
  list: (filters: EwbListFilters) => [...ewbKeys.all, "list", filters] as const,
  detail: (ewbNo: string) => [...ewbKeys.all, "detail", ewbNo] as const,
  liveGstin: (gstin: string) => [...ewbKeys.all, "live", "gstin", gstin] as const,
  liveHsn: (hsn: string) => [...ewbKeys.all, "live", "hsn", hsn] as const,
};
