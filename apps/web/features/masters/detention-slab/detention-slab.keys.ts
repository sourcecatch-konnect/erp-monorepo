import type { ListQuery } from "../_shared/master-api";

export const detentionSlabKeys = {
  all: ["detention-slabs"] as const,
  list: (query: ListQuery) => ["detention-slabs", "list", query] as const,
};
