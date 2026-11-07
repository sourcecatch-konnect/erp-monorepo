import type { ListQuery } from "../_shared/master-api";

export const detentionSlabKeys = {
  all: ["detention-slabs"] as const,
  list: (query: ListQuery) => ["detention-slabs", "list", query] as const,
};

export const detentionQuoteKeys = {
  all: ["detention-quote"] as const,
  byChallan: (challanId: string) => ["detention-quote", challanId] as const,
};
