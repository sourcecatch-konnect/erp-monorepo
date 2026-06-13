import type { ListQuery } from "../_shared/master-api";

export const warehouseKeys = {
  /* -----------------------------
     BASE KEY
  ------------------------------ */
  all: ["warehouses"] as const,

  /* -----------------------------
     LIST (with filters/query)
  ------------------------------ */
  list: (query?: ListQuery) =>
    [...warehouseKeys.all, "list", query] as const,

  /* -----------------------------
     DETAIL (single warehouse)
  ------------------------------ */
  detail: (id: string) =>
    [...warehouseKeys.all, "detail", id] as const,

  /* -----------------------------
     SEARCH
  ------------------------------ */
  search: (q: string) =>
    [...warehouseKeys.all, "search", q] as const,

  /* -----------------------------
     BULK (optional but useful)
  ------------------------------ */
  bulk: () =>
    [...warehouseKeys.all, "bulk"] as const,
};