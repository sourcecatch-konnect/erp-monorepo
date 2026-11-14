"use client";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  jobCardReportApi,
  type AuditParams,
} from "./api/job-card-report.service";
import { jobCardKeys } from "./api/job-card.keys";

export function useJobCardAudit() {
  const [mode, setMode] = React.useState<AuditParams["mode"]>("SETTLEMENTS");
  const [view, setView] = React.useState<AuditParams["view"]>("ISSUES");
  const [search, setSearch] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [size, setSize] = React.useState(20);
  const debounced = useDebouncedValue(search.trim(), 400);
  const isPeriod = mode === "POSTINGS" || mode === "TALLY";
  const key = JSON.stringify([
    mode,
    view,
    debounced,
    isPeriod && from,
    isPeriod && to,
    size,
  ]);
  const [paging, setPaging] = React.useState({ key, page: 0 });
  const page = paging.key === key ? paging.page : 0;
  if (paging.key !== key) setPaging({ key, page: 0 });
  const invalidDates = isPeriod && Boolean(from && to && from > to);
  const params: AuditParams = {
    mode,
    view,
    search: debounced || undefined,
    from: isPeriod && from ? from : undefined,
    to: isPeriod && to ? to : undefined,
    page,
    size,
  };
  const query = useQuery({
    queryKey: [...jobCardKeys.all, "audit", params],
    queryFn: ({ signal }) => jobCardReportApi.audit(params, signal),
    enabled: !invalidDates,
    staleTime: 0,
  });
  return {
    query,
    mode,
    setMode,
    view,
    setView,
    search,
    setSearch,
    from,
    setFrom,
    to,
    setTo,
    size,
    setSize,
    page,
    setPage: (next: number) => setPaging({ key, page: next }),
    isPeriod,
    invalidDates,
  };
}
