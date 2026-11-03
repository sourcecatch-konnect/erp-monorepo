import type { ClaimListParams } from "./claim.service";

export const claimKeys = {
  all: ["claims"] as const,
  list: (params: ClaimListParams) => [...claimKeys.all, "list", params] as const,
};
