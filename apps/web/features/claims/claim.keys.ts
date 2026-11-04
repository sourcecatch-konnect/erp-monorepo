import type { ClaimFilters, ClaimListParams } from "./claim.service";

export const claimKeys = {
  all: ["claims"] as const,
  list: (params: ClaimListParams) => [...claimKeys.all, "list", params] as const,
  summary: (filters: ClaimFilters) => [...claimKeys.all, "summary", filters] as const,
  detail: (id: string) => [...claimKeys.all, "detail", id] as const,
  eligibleLrs: (search: string) => [...claimKeys.all, "eligible-lrs", search] as const,
  settlementOptions: (id: string) => [...claimKeys.all, "settlement-options", id] as const,
  fundingAccounts: (id: string) => [...claimKeys.all, "funding-accounts", id] as const,
};
