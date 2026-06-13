import type { ListQuery } from "../_shared/master-api";

export const sparePartKeys = {
  all: ["spare-parts"] as const,
  list: (query?: ListQuery) => [...sparePartKeys.all, "list", query] as const,
  detail: (id: string) => [...sparePartKeys.all, "detail", id] as const,
};