import { ListQuery } from "../_shared/master-api";

export const driverKeys = {
  all: ["drivers"] as const,
  list: (query?: ListQuery) =>
    [...driverKeys.all, "list", query] as const,
  lookup: (query?: Record<string, string | number | undefined>) =>
    [...driverKeys.all, "lookup", query] as const,
  detail: (id: string) =>
    [...driverKeys.all, "detail", id] as const,
};
