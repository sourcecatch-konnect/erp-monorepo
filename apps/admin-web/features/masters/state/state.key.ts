export const stateKeys = {
  all: ["states"] as const,

  list: () =>
    [...stateKeys.all, "list"] as const,

  detail: (id: string) =>
    [...stateKeys.all, "detail", id] as const,
};