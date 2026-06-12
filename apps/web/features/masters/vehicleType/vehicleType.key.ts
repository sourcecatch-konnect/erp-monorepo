import { ListQuery } from "../_shared/master-api";

export const vehicleTypeKeys = {
  all: ["vehicle-type"] as const,
  list: (query?: ListQuery) =>
    [...vehicleTypeKeys.all, "list", query] as const,
  detail: (id: string) => [...vehicleTypeKeys.all, "detail", id] as const,
};
