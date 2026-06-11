import { ListQuery } from "../_shared/master-api";

export const areaKeys = {
  all: ["areas"] as const,

  list: (query?: ListQuery) =>
    [...areaKeys.all, "list", query] as const,

  detail: (id: string) =>
    [...areaKeys.all, "detail", id] as const,
};