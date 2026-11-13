"use client";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { jobCardKeys } from "./api/job-card.keys";
import {
  jobCardReportApi,
  type ReconciliationKind,
} from "./api/job-card-report.service";

export function useJobCardReconciliation() {
  const [search, setSearch] = React.useState("");
  const [kind, setKind] = React.useState<ReconciliationKind | "">("");
  const [view, setView] = React.useState<"ISSUES" | "ALL">("ISSUES");
  const [size, setSize] = React.useState(20);
  const debouncedSearch = useDebouncedValue(search.trim(), 400);
  const key = JSON.stringify([debouncedSearch, kind, view, size]);
  const [paging, setPaging] = React.useState({ key, page: 0 });
  const page = paging.key === key ? paging.page : 0;
  if (paging.key !== key) setPaging({ key, page: 0 });
  const params = {
    page,
    size,
    search: debouncedSearch || undefined,
    kind: kind || undefined,
    view,
  };
  const query = useQuery({
    queryKey: [...jobCardKeys.all, "reconciliation", params],
    queryFn: ({ signal }) => jobCardReportApi.reconciliation(params, signal),
    staleTime: 0,
  });
  return {
    query,
    search,
    setSearch,
    kind,
    setKind,
    view,
    setView,
    size,
    setSize,
    page,
    setPage: (next: number) => setPaging({ key, page: next }),
  };
}
