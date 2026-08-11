import { ListQuery } from "../_shared/master-api";

export const branchKeys = {
  all: ["branches"] as const,

  list: (query?: ListQuery) => [...branchKeys.all, "list", query] as const,

  detail: (id: string) => [...branchKeys.all, "detail", id] as const,

  railheads: (id: string) => [...branchKeys.all, "railheads", id] as const,
};
