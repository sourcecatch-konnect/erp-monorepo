export const cityKeys = {
  all: ["cities"] as const,

  list: () => [...cityKeys.all, "list"] as const,

  detail: (id: string) =>
    [...cityKeys.all, "detail", id] as const,
};