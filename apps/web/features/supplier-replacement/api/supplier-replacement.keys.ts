export const supplierReplacementKeys = {
  all: ["supplier-replacement"] as const,
  lists: (params?: unknown) => [...supplierReplacementKeys.all, "lists", params] as const,
  detail: (id: string) => [...supplierReplacementKeys.all, "detail", id] as const,
  inwards: (replacementListId: string) =>
    [...supplierReplacementKeys.all, "inwards", replacementListId] as const,
  postedInwards: (supplierId: string) =>
    [...supplierReplacementKeys.all, "posted-inwards", supplierId] as const,
  originalInward: (id: string) => [...supplierReplacementKeys.all, "original-inward", id] as const,
  suppliers: ["supplier-replacement", "suppliers"] as const,
  headOfficeBranch: ["supplier-replacement", "head-office-branch"] as const,
};
