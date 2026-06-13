import type { ListQuery } from "../masters/_shared/master-api";

export const lrKeys = {
  all: ["lorry-receipts"] as const,
  list: (query: ListQuery) => ["lorry-receipts", "list", query] as const,
  statusCounts: ["lorry-receipts", "status-counts"] as const,
  detail: (id: string) => ["lorry-receipts", "detail", id] as const,
};
