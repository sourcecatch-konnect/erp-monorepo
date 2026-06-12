import { ListQuery } from "../_shared/master-api";

export const transportKeys = {
  all: ["transports"] as const,
  list: (query?: ListQuery) =>
    [...transportKeys.all, "list", query] as const,
  detail: (id: string) =>
    [...transportKeys.all, "detail", id] as const,
};