import { ListQuery } from "../_shared/master-api";

export const vehicleKeys = {
  all: ["vehicles"] as const,
  list: (query?: ListQuery) =>
    [...vehicleKeys.all, "list", query] as const,
  lookup: (query?: Record<string, string | number | undefined>) =>
    [...vehicleKeys.all, "lookup", query] as const,
  detail: (id: string) =>
    [...vehicleKeys.all, "detail", id] as const,
};
