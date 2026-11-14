"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { jobCardApi, type JobCardStatus } from "./api/job-card.service";
import { jobCardKeys } from "./api/job-card.keys";

export function useJobCardList() {
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<JobCardStatus | "ALL">("ALL");
  const [size, setSize] = React.useState(10);
  const debouncedSearch = useDebouncedValue(search.trim(), 400);
  const filterKey = JSON.stringify([debouncedSearch, status, size]);
  const [pagination, setPagination] = React.useState({
    key: filterKey,
    page: 0,
  });
  // Derive page zero immediately when filters change: no request for an old
  // page with the new search term, and no effect racing a page reset.
  const page = pagination.key === filterKey ? pagination.page : 0;
  if (pagination.key !== filterKey) {
    setPagination({ key: filterKey, page: 0 });
  }
  const params = {
    page,
    size,
    search: debouncedSearch || undefined,
    status: status === "ALL" ? undefined : status,
  };
  const list = useQuery({
    queryKey: jobCardKeys.list(params),
    queryFn: ({ signal }) => jobCardApi.list(params, signal),
    // Every page navigation requests current backend data; no prefetching.
    staleTime: 0,
  });

  return {
    search,
    setSearch,
    status,
    setStatus,
    size,
    setSize,
    page,
    list,
    setPage: (next: number) => setPagination({ key: filterKey, page: next }),
  };
}
