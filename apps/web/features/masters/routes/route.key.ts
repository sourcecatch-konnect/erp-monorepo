import type { ListQuery } from "../_shared/master-api";

export const routeKeys = {
  all: ["routes"] as const,

  list: (query?: ListQuery) =>
    [...routeKeys.all, "list", query] as const,

  detail: (id: string) =>
    [...routeKeys.all, "detail", id] as const,
};