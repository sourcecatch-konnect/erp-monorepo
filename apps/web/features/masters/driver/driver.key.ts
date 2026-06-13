import { ListQuery } from "../_shared/master-api";

export const driverKeys = {
  all: ["drivers"] as const,
  list: (query?: ListQuery) =>
    [...driverKeys.all, "list", query] as const,
  detail: (id: string) =>
    [...driverKeys.all, "detail", id] as const,
};
