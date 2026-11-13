"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { serviceBillKeys } from "./api/service-bill.keys";
import {
  serviceBillReportApi,
  type AgeBucket,
} from "./api/service-bill-report.service";

export function useServiceBillOutstanding() {
  const [search, setSearch] = React.useState("");
  const [bucket, setBucket] = React.useState<AgeBucket | "">("");
  const [size, setSize] = React.useState(20);
  const debouncedSearch = useDebouncedValue(search.trim(), 400);
  const key = JSON.stringify([debouncedSearch, bucket, size]);
  const [paging, setPaging] = React.useState({ key, page: 0 });
  const page = paging.key === key ? paging.page : 0;
  if (paging.key !== key) setPaging({ key, page: 0 });
  const params = {
    page,
    size,
    search: debouncedSearch || undefined,
    bucket: bucket || undefined,
  };
  const query = useQuery({
    queryKey: [...serviceBillKeys.all, "outstanding", params],
    queryFn: ({ signal }) => serviceBillReportApi.outstanding(params, signal),
    staleTime: 0,
  });
  return {
    query,
    search,
    setSearch,
    bucket,
    setBucket,
    size,
    setSize,
    page,
    setPage: (next: number) => setPaging({ key, page: next }),
  };
}
