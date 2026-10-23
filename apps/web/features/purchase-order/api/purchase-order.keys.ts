export const purchaseOrderKeys = {
  all: ["purchase-order"] as const,
  list: (params?: unknown) => [...purchaseOrderKeys.all, "list", params] as const,
  detail: (id: string) => [...purchaseOrderKeys.all, "detail", id] as const,
  branches: ["purchase-order", "branches"] as const,
  suppliers: (search?: string) => ["purchase-order", "suppliers", search] as const,
  spareParts: (branchId?: string, search?: string) =>
    ["purchase-order", "spare-parts", branchId, search] as const,
};
