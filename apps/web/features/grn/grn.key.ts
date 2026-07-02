import type { ListQuery } from "../masters/_shared/master-api";

export const grnKeys = {
  all: ["grn"] as const,

  list: (query: ListQuery) =>
    ["grn", "list", query] as const,

  statusCounts: ["grn", "status-counts"] as const,

  detail: (id: string) =>
    ["grn", "detail", id] as const,

  lrPreview: (lorryReceiptId: string) =>
    ["grn", "preview", "lr", lorryReceiptId] as const,
};