import type { ListQuery } from "../_shared/master-api";

export const sparePartSupplierKeys = {
  all: ["spare-part-suppliers"] as const,
  list: (query?: ListQuery) =>
    [...sparePartSupplierKeys.all, "list", query] as const,
  detail: (id: string) =>
    [...sparePartSupplierKeys.all, "detail", id] as const,
};