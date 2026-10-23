import type { MyWorkListFilter } from "./my-work.service";

export const myWorkKeys = {
  all: ["my-work"] as const,
  count: ["my-work", "count"] as const,
  /** null = every branch the user can see. */
  overview: (branch: string | null) =>
    ["my-work", "overview", branch ?? "all"] as const,
  list: (filter: MyWorkListFilter, page: number, size: number) =>
    ["my-work", "list", filter, page, size] as const,
};
