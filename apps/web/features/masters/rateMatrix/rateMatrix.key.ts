import type { ListQuery } from "../_shared/master-api";

export const rateMatrixKeys = {
  all: ["rate-matrix"] as const,
  lists: () => [...rateMatrixKeys.all, "list"] as const,
  list: (query?: unknown) => [...rateMatrixKeys.lists(), query] as const,
  detail: (id: string) => [...rateMatrixKeys.all, "detail", id] as const,

  byAgreement: (agreementId: string) =>
    [...rateMatrixKeys.all, "by-agreement", agreementId] as const,
};