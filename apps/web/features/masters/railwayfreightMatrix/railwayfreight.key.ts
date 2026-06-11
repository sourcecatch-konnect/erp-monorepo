import type { ListQuery } from "../_shared/master-api";

export const railwayFreightKeys = {
  all: ["railway-freight"] as const,

  list: (query?: ListQuery) =>
    [...railwayFreightKeys.all, "list", query] as const,

  detail: (id: string) =>
    [...railwayFreightKeys.all, "detail", id] as const,
};