import type { ListQuery } from "../_shared/master-api";

export const labourKeys = {
  all: ["labours"] as const,

  list: (query?: ListQuery) =>
    [...labourKeys.all, "list", query] as const,

  detail: (id: string) =>
    [...labourKeys.all, "detail", id] as const,
};