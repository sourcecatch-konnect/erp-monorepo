// apps/web/src/features/grn/grn.key.ts

import type { ListQuery } from "../masters/_shared/master-api";

export const grnKeys = {
  all: ["grn"] as const,

  list: (query: ListQuery) =>
    ["grn", "list", query] as const,

  detail: (id: string) =>
    ["grn", "detail", id] as const,

  preview: (lrId: string) =>
    ["grn", "preview", lrId] as const,
};

export const grnLookupKeys = {
  eligibleLRs: (query: ListQuery) =>
    ["grn-lookups", "eligible-lrs", query] as const,
};