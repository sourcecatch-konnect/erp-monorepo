"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { jobCardReportApi } from "./api/job-card-report.service";
import { jobCardKeys } from "./api/job-card.keys";

export function useJobCardRepairCosts() {
  const [search, setSearch] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [size, setSize] = React.useState(20);
  const debouncedSearch = useDebouncedValue(search.trim(), 400);
  const key = JSON.stringify([debouncedSearch, from, to, size]);
  const [paging, setPaging] = React.useState({ key, page: 0 });
  const page = paging.key === key ? paging.page : 0;
  if (paging.key !== key) setPaging({ key, page: 0 });
  const invalidDates = Boolean(from && to && from > to);
  const params = {
    page,
    size,
    search: debouncedSearch || undefined,
    from: from || undefined,
    to: to || undefined,
  };
  const query = useQuery({
    queryKey: [...jobCardKeys.all, "repair-costs", params],
    queryFn: ({ signal }) => jobCardReportApi.costs(params, signal),
    staleTime: 0,
    enabled: !invalidDates,
  });
  return {
    query,
    search,
    setSearch,
    from,
    setFrom,
    to,
    setTo,
    size,
    setSize,
    page,
    invalidDates,
    setPage: (next: number) => setPaging({ key, page: next }),
  };
}
