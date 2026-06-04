import type { ListQuery } from "../masters/_shared/master-api";

export const orderKeys = {
  all: ["orders"] as const,
  list: (query: ListQuery) => ["orders", "list", query] as const,
  statusCounts: ["orders", "status-counts"] as const,
  detail: (id: string) => ["orders", "detail", id] as const,
};
