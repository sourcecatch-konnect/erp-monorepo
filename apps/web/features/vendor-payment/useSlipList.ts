"use client";

import * as React from "react";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";

import {
  vendorPaymentApi,
  type VendorPaymentStatus,
  type VendorPaymentType,
} from "./vendor-payment.service";

// Rows per request. A list is never loaded whole: the first chunk arrives with
// the page and each further chunk only when "Load more" is clicked.
const CHUNK_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

type UseSlipListOptions = {
  /** Distinguishes this list's cache entries (e.g. "approval-queue"). */
  scope: string;
  status?: VendorPaymentStatus | VendorPaymentStatus[];
  type?: VendorPaymentType;
};

/**
 * A slip list paged and searched entirely in the backend: the search box is
 * debounced and sent to the server (so it matches every slip, not just the
 * loaded chunks) and further chunks are fetched on demand.
 */
export function useSlipList({ scope, status, type }: UseSlipListOptions) {
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const statusKey = Array.isArray(status) ? status.join(",") : (status ?? "");

  const query = useInfiniteQuery({
    queryKey: ["vendor-payment", scope, statusKey, type ?? "", debouncedSearch],
    queryFn: ({ pageParam }) =>
      vendorPaymentApi.listSlips({
        page: pageParam,
        size: CHUNK_SIZE,
        status,
        type,
        search: debouncedSearch || undefined,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.data.length, 0);
      return loaded < (lastPage.meta?.total ?? 0) ? allPages.length : undefined;
    },
    // Keep the previous results on screen while a new search term is fetched.
    placeholderData: keepPreviousData,
  });

  const slips = React.useMemo(
    () => query.data?.pages.flatMap((page) => page.data) ?? [],
    [query.data],
  );

  return {
    search,
    setSearch,
    isSearching: Boolean(debouncedSearch),
    debouncedSearch,
    query,
    slips,
    total: query.data?.pages.at(-1)?.meta?.total ?? 0,
  };
}
