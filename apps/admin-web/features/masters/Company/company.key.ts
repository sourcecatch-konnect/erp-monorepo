import { ListQuery } from "../_shared/master-api";

export const companyKeys = {
  all: ["companies"] as const,
  list: (query?: ListQuery) =>
    [...companyKeys.all, "list", query] as const,
  detail: (id: string) =>
    [...companyKeys.all, "detail", id] as const,
};