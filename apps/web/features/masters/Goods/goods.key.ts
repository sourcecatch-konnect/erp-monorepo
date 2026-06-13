import type { ListQuery } from "../_shared/master-api";

export const goodsKeys = {
  all: ["goods"] as const,

  list: (query?: ListQuery) =>
    [...goodsKeys.all, "list", query] as const,

  detail: (id: string) =>
    [...goodsKeys.all, "detail", id] as const,
};