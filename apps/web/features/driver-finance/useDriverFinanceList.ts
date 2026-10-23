"use client";

import * as React from "react";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { ListResult } from "@/features/masters/_shared/master-api";
import {
  driverFinanceApi,
  type DriverFinanceListQuery,
  type DriverPayout,
  type DriverSalaryAdvance,
} from "./driver-finance.service";

const CHUNK_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

type Fetchers = {
  "salary-advances": DriverSalaryAdvance;
  payouts: DriverPayout;
};

const fetchers: {
  [K in keyof Fetchers]: (q: DriverFinanceListQuery) => Promise<ListResult<Fetchers[K]>>;
} = {
  "salary-advances": driverFinanceApi.salaryAdvances,
  payouts: driverFinanceApi.payouts,
};

/** A register paged and searched in the backend, loaded a chunk at a time. */
export function useDriverFinanceList<K extends keyof Fetchers>(kind: K) {
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);

  const query = useInfiniteQuery({
    queryKey: ["driver-finance", kind, "list", debouncedSearch],
    queryFn: ({ pageParam }) =>
      fetchers[kind]({
        page: pageParam,
        size: CHUNK_SIZE,
        search: debouncedSearch || undefined,
      }) as Promise<ListResult<Fetchers[K]>>,
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.data.length, 0);
      return loaded < (lastPage.meta?.total ?? 0) ? allPages.length : undefined;
    },
    placeholderData: keepPreviousData,
  });

  const rows = React.useMemo(
    () => query.data?.pages.flatMap((page) => page.data) ?? [],
    [query.data],
  );

  return {
    search,
    setSearch,
    isSearching: Boolean(debouncedSearch),
    debouncedSearch,
    query,
    rows,
    total: query.data?.pages.at(-1)?.meta?.total ?? 0,
  };
}
