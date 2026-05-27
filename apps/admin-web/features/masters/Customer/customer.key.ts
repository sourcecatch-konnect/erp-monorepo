import type { ListQuery } from "../_shared/master-api";

export const customerKeys = {
  all: ["customers"] as const,
  list: (query?: ListQuery) => [...customerKeys.all, "list", query] as const,
  detail: (id: string) => [...customerKeys.all, "detail", id] as const,
};