import { ListQuery } from "../_shared/master-api";

export const cityKeys = {
  all: ["cities"] as const,
  list: (query?: ListQuery) => [...cityKeys.all, "list", query] as const,
  detail: (id: string) => [...cityKeys.all, "detail", id] as const,
};
