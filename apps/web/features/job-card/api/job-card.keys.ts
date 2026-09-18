export const jobCardKeys = {
  all: ["job-card"] as const,
  list: (params?: unknown) => [...jobCardKeys.all, "list", params] as const,
  detail: (id: string) => [...jobCardKeys.all, "detail", id] as const,
  removedParts: (id: string) => [...jobCardKeys.all, "removed-parts", id] as const,
  batches: (sparePartId: string, branchId: string) =>
    [...jobCardKeys.all, "batches", sparePartId, branchId] as const,
  branches: ["job-card", "branches"] as const,
  vehicles: ["job-card", "vehicles"] as const,
  drivers: ["job-card", "drivers"] as const,
  mechanics: ["job-card", "mechanics"] as const,
  spareParts: (type: "Item" | "Service", categoryId?: string) =>
    ["job-card", "spare-parts", type, categoryId] as const,
  categories: (type: "Item" | "Service") => ["job-card", "categories", type] as const,
  serviceProviders: ["job-card", "service-providers"] as const,
};
