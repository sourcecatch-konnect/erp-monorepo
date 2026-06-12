import type { ListQuery } from "../_shared/master-api";

export const rateMatrixKeys = {
  all: ["rateMatrix"] as const,

  list: (query?: ListQuery) =>
    [...rateMatrixKeys.all, "list", query] as const,

  detail: (id: string) =>
    [...rateMatrixKeys.all, "detail", id] as const,

  search: (q: string) =>
    [...rateMatrixKeys.all, "search", q] as const,
};