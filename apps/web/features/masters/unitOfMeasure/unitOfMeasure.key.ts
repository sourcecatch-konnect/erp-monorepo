import { ListQuery } from "../_shared/master-api";

export const unitOfMeasureKeys = {
  all: ["unit-of-measures"] as const,
  list: (query?: ListQuery) =>
    [...unitOfMeasureKeys.all, "list", query] as const,
  detail: (id: string) => [...unitOfMeasureKeys.all, "detail", id] as const,
};
