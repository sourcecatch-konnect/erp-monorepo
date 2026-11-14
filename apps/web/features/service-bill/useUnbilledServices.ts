"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  serviceBillApi,
  type UnbilledServiceLine,
} from "./api/service-bill.service";
import { serviceBillKeys } from "./api/service-bill.keys";

export function useUnbilledServices(
  serviceProviderId: string,
  branchId: string,
  uptoDate: string,
  enabled: boolean,
) {
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 400);
  const selectionKey = JSON.stringify([
    serviceProviderId,
    branchId,
    uptoDate,
    enabled,
  ]);
  const filterKey = JSON.stringify([selectionKey, debouncedSearch]);
  const [paging, setPaging] = React.useState({ key: filterKey, page: 0 });
  const [selection, setSelection] = React.useState({
    key: selectionKey,
    lines: new Map<string, UnbilledServiceLine>(),
  });
  const page = paging.key === filterKey ? paging.page : 0;
  if (paging.key !== filterKey) setPaging({ key: filterKey, page: 0 });
  if (selection.key !== selectionKey)
    setSelection({ key: selectionKey, lines: new Map() });
  const params = {
    serviceProviderId,
    branchId,
    uptoDate: uptoDate || undefined,
    search: debouncedSearch || undefined,
    page,
    size: 20,
  };
  const query = useQuery({
    queryKey: [...serviceBillKeys.all, "unbilled", params],
    queryFn: ({ signal }) => serviceBillApi.unbilledLines(params, signal),
    enabled: enabled && Boolean(serviceProviderId) && Boolean(branchId),
  });
  return {
    query,
    search,
    setSearch,
    page,
    setPage: (next: number) => setPaging({ key: filterKey, page: next }),
    selectedLines:
      selection.key === selectionKey
        ? selection.lines
        : new Map<string, UnbilledServiceLine>(),
    clearSelection: () => setSelection({ key: selectionKey, lines: new Map() }),
    toggleLine: (line: UnbilledServiceLine) =>
      setSelection((previous) => {
        const lines = new Map(
          previous.key === selectionKey ? previous.lines : [],
        );
        if (lines.has(line.id)) lines.delete(line.id);
        else if (lines.size < 500) lines.set(line.id, line);
        return { key: selectionKey, lines };
      }),
  };
}
