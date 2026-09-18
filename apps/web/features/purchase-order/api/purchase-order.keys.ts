export const purchaseOrderKeys = {
  all: ["purchase-order"] as const,
  list: (params?: unknown) => [...purchaseOrderKeys.all, "list", params] as const,
  detail: (id: string) => [...purchaseOrderKeys.all, "detail", id] as const,
  branches: ["purchase-order", "branches"] as const,
  suppliers: ["purchase-order", "suppliers"] as const,
  spareParts: (branchId?: string) => ["purchase-order", "spare-parts", branchId] as const,
};
