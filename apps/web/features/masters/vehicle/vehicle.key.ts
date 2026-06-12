import { ListQuery } from "../_shared/master-api";

export const vehicleKeys = {
  all: ["vehicles"] as const,
  list: (query?: ListQuery) =>
    [...vehicleKeys.all, "list", query] as const,
  detail: (id: string) =>
    [...vehicleKeys.all, "detail", id] as const,
};