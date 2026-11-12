"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { jobCardApi } from "./api/job-card.service";
import { jobCardKeys } from "./api/job-card.keys";

export function useRemovedParts(jobCardId: string) {
  const [search, setSearch] = React.useState("");
  const [size, setSize] = React.useState(10);
  const debouncedSearch = useDebouncedValue(search.trim(), 400);
  const key = JSON.stringify([jobCardId, debouncedSearch, size]);
  const [paging, setPaging] = React.useState({ key, page: 0 });
  const page = paging.key === key ? paging.page : 0;
  if (paging.key !== key) setPaging({ key, page: 0 });
  const params = { page, size, search: debouncedSearch || undefined };
  const query = useQuery({
    queryKey: [...jobCardKeys.removedParts(jobCardId), params],
    queryFn: ({ signal }) => jobCardApi.removedParts(jobCardId, params, signal),
  });
  return {
    query,
    search,
    setSearch,
    page,
    size,
    setSize,
    setPage: (next: number) => setPaging({ key, page: next }),
  };
}
