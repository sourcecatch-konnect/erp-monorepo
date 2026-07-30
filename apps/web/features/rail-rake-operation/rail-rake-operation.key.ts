export const railRakeOperationKeys = {
  all: ["rail-rake-operations"] as const,
  lists: () => [...railRakeOperationKeys.all, "list"] as const,
  list: (query: object) => [...railRakeOperationKeys.lists(), query] as const,
  detail: (id: string) => [...railRakeOperationKeys.all, "detail", id] as const,
  rakes: (stage?: string) =>
    [...railRakeOperationKeys.all, "options", "rakes", stage ?? "ALL"] as const,
};
