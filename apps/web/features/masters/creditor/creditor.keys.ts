import { ListQuery } from "../_shared/master-api";

export const creditorKeys = {
  all: ["creditors"] as const,
  list: (query?: ListQuery) => [...creditorKeys.all, "list", query] as const,
  detail: (id: string) => [...creditorKeys.all, "detail", id] as const,
};
