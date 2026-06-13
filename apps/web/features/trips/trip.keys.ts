import type { ListQuery } from "../masters/_shared/master-api";

export const tripKeys = {
  all: ["trips"] as const,
  list: (query: ListQuery) => ["trips", "list", query] as const,
  statusCounts: ["trips", "status-counts"] as const,
  detail: (id: string) => ["trips", "detail", id] as const,
};
