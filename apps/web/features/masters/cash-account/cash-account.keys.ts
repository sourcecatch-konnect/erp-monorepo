import { ListQuery } from "../_shared/master-api";

export const cashAccountKeys = {
  all: ["cash-accounts"] as const,
  list: (query?: ListQuery) => [...cashAccountKeys.all, "list", query] as const,
  detail: (id: string) => [...cashAccountKeys.all, "detail", id] as const,
};
