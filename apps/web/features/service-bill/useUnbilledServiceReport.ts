"use client";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { jobCardKeys } from "@/features/job-card/api/job-card.keys";
import { serviceBillReportApi } from "./api/service-bill-report.service";

export function useUnbilledServiceReport() {
  const [search, setSearch] = React.useState("");
  const [completedTo, setCompletedTo] = React.useState("");
  const [size, setSize] = React.useState(20);
  const debouncedSearch = useDebouncedValue(search.trim(), 400);
  const key = JSON.stringify([debouncedSearch, completedTo, size]);
  const [paging, setPaging] = React.useState({ key, page: 0 });
  const page = paging.key === key ? paging.page : 0;
  if (paging.key !== key) setPaging({ key, page: 0 });
  const params = {
    page,
    size,
    search: debouncedSearch || undefined,
    completedTo: completedTo || undefined,
  };
  const query = useQuery({
    queryKey: [...jobCardKeys.all, "unbilled-report", params],
    queryFn: ({ signal }) => serviceBillReportApi.unbilled(params, signal),
    staleTime: 0,
  });
  return {
    query,
    search,
    setSearch,
    completedTo,
    setCompletedTo,
    size,
    setSize,
    page,
    setPage: (next: number) => setPaging({ key, page: next }),
  };
}
