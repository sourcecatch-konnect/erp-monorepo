import { Request } from "express";

export type SortDirection = "asc" | "desc";

export type ListQuery = {
  page: number;
  size: number;
  search?: string;
  sort?: {
    field: string;
    direction: SortDirection;
  };
  filter: Record<string, string>;
};

const toPositiveInt = (
  value: unknown,
  fallback: number,
  max?: number
) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }

  return max ? Math.min(parsed, max) : parsed;
};

export const parseListQuery = (req: Request): ListQuery => {
  const page = toPositiveInt(req.query.page, 0);
  const size = toPositiveInt(req.query.size, 25, 100);
  const search =
    typeof req.query.search === "string" && req.query.search.trim()
      ? req.query.search.trim()
      : undefined;

  const sort =
    typeof req.query.sort === "string" && req.query.sort.includes(":")
      ? req.query.sort
      : undefined;

  const [field, direction] = sort ? sort.split(":") : [];

  const filter: Record<string, string> = {};
  const rawFilter = req.query.filter;

  if (
    rawFilter &&
    typeof rawFilter === "object" &&
    !Array.isArray(rawFilter)
  ) {
    Object.entries(rawFilter).forEach(([key, value]) => {
      if (typeof value === "string" && value.trim()) {
        filter[key] = value.trim();
      }
    });
  }
Object.entries(req.query).forEach(([key, value]) => {
  const match = key.match(/^filter\[(.+)\]$/);

const filterKey = match?.[1];

if (filterKey && typeof value === "string" && value.trim()) {
  filter[filterKey] = value.trim();
}
});
  return {
    page,
    size,
    search,
    filter,
    ...(field && (direction === "asc" || direction === "desc")
      ? { sort: { field, direction } }
      : {}),
  };
};
