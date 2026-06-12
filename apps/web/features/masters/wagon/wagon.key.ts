import { ListQuery } from "../_shared/master-api";

export const wagonKeys = {
  all: ["wagons"] as const,

  list: (query?: ListQuery) =>
    [...wagonKeys.all, "list", query] as const,

  detail: (id: string) =>
    [...wagonKeys.all, "detail", id] as const,
};