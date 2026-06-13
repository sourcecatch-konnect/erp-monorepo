import { ListQuery } from "../_shared/master-api";

export const spareCategoryKeys = {
  all: ["spare-category"] as const,

  list: (query?: ListQuery) =>
    [...spareCategoryKeys.all, "list", query] as const,

  detail: (id: string) =>
    [...spareCategoryKeys.all, "detail", id] as const,
};