import type { ListQuery } from "../_shared/master-api";

export const agreementKeys = {
  all: ["agreements"] as const,
  list: (query?: ListQuery) =>
    [...agreementKeys.all, "list", query] as const,
  detail: (id: string) =>
    [...agreementKeys.all, "detail", id] as const,
};