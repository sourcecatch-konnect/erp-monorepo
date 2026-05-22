import { ListQuery } from "../_shared/master-api";

export const stateKeys = {
  all: ["states"] as const,
  list: (query?: ListQuery) => [...stateKeys.all, "list", query] as const,
  detail: (id: string) => [...stateKeys.all, "detail", id] as const,
};
