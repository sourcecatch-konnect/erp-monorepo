import type { ListQuery } from "../masters/_shared/master-api";

export const lrGroupKeys = {
  all: ["lr-groups"] as const,
  list: (query: ListQuery) => ["lr-groups", "list", query] as const,
  statusCounts: ["lr-groups", "status-counts"] as const,
  detail: (id: string) => ["lr-groups", "detail", id] as const,
};
