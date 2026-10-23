export const spareInwardKeys = {
  all: ["spare-inward"] as const,
  list: (params?: unknown) => [...spareInwardKeys.all, "list", params] as const,
  detail: (id: string) => [...spareInwardKeys.all, "detail", id] as const,
  openPOs: (supplierId: string) => [...spareInwardKeys.all, "open-pos", supplierId] as const,
};
