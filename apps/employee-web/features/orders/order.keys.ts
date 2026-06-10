import type { ListQuery } from "@/lib/master-api";

export const orderKeys = {
    all: ["orders"] as const,
    list: (query: ListQuery) => ["orders", "list", query] as const,
    statusCounts: ["orders", "status-counts"] as const,
    quickView: (id: string) => ["orders", "quick-view", id] as const,
    detail: (id: string) => ["orders", "detail", id] as const,
};