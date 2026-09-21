export const supplierReplacementKeys = {
  all: ["supplier-replacement"] as const,
  lists: (params?: unknown) => [...supplierReplacementKeys.all, "lists", params] as const,
  detail: (id: string) => [...supplierReplacementKeys.all, "detail", id] as const,
  inwards: (replacementListId: string, params?: unknown) =>
    [...supplierReplacementKeys.all, "inwards", replacementListId, params] as const,
  postedInwards: (supplierId: string) =>
    [...supplierReplacementKeys.all, "posted-inwards", supplierId] as const,
  originalInward: (id: string) => [...supplierReplacementKeys.all, "original-inward", id] as const,
  suppliers: (search?: string) => ["supplier-replacement", "suppliers", search] as const,
  headOfficeBranch: ["supplier-replacement", "head-office-branch"] as const,
};
