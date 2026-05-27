import { ListQuery } from "../_shared/master-api";

export const pumpKeys = {
  all: ["pumps"] as const,

  list: (query?: ListQuery) =>
    [...pumpKeys.all, "list", query] as const,

  detail: (id: string) =>
    [...pumpKeys.all, "detail", id] as const,

  search: (q: string) =>
    [...pumpKeys.all, "search", q] as const,
};