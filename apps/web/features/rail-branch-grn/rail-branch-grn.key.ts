export const railBranchGrnKeys = {
  all: ["rail-branch-grns"] as const,
  lists: () => [...railBranchGrnKeys.all, "list"] as const,
  list: (query: object) => [...railBranchGrnKeys.lists(), query] as const,
  detail: (id: string) => ["rail-branch-grns", "detail", id] as const,
  preview: (railRakeId: string, vpWagonLoadingId: string) =>
    [
      ...railBranchGrnKeys.all,
      "preview",
      railRakeId,
      vpWagonLoadingId,
    ] as const,
};
