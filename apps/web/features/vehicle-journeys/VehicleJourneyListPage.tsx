"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { IconPlus } from "@tabler/icons-react";

import { useCan } from "@/features/auth";
import { useTablePrefs } from "@/features/table-prefs";
import { useDebouncedValue } from "../masters/_shared/hooks/useDebouncedValue";
import type { ListQuery } from "../masters/_shared/master-api";

import { journeyApi } from "./journey.service";
import { journeyKeys } from "./journey.keys";
import JourneyTable, { DEFAULT_JOURNEY_COLUMN_ORDER } from "./JourneyTable";
import StartJourneyDialog from "./StartJourneyDialog";

export default function VehicleJourneyListPage() {
  const router = useRouter();
  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(10);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [startedFrom, setStartedFrom] = React.useState("");
  const [startedTo, setStartedTo] = React.useState("");
  const [sort, setSort] = React.useState("startedAt:desc");
  const [startOpen, setStartOpen] = React.useState(false);
  const debouncedSearch = useDebouncedValue(search);

  const canCreate = useCan(PERMS.VEHICLE_JOURNEY.CREATE);

  // Per-user layout, persisted server-side (follows the account, not the
  // browser). Defaults render until the saved layout loads.
  const { columnVisibility, setColumnVisibility, columnOrder, setColumnOrder } =
    useTablePrefs("vehicle-journeys", DEFAULT_JOURNEY_COLUMN_ORDER);

  React.useEffect(
    () => setPage(0),
    [debouncedSearch, statusFilter, startedFrom, startedTo, sort],
  );

  const listQuery = React.useMemo<ListQuery>(() => {
    const filter: Record<string, string> = {};
    if (statusFilter !== "ALL") filter.status = statusFilter;
    if (startedFrom) filter.startedFrom = startedFrom;
    if (startedTo) filter.startedTo = startedTo;

    return {
      page,
      size,
      sort,
      ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
      ...(Object.keys(filter).length ? { filter } : {}),
    };
  }, [page, size, sort, debouncedSearch, statusFilter, startedFrom, startedTo]);

  const journeys = useQuery({
    queryKey: journeyKeys.list(listQuery),
    queryFn: () => journeyApi.list(listQuery),
    staleTime: 30_000,
  });

  const counts = useQuery({
    queryKey: journeyKeys.statusCounts,
    queryFn: journeyApi.statusCounts,
    staleTime: 0,
  });

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Vehicle Journeys</h1>
          <p className="text-xs text-muted-foreground">
            Full truck cycles — legs, expenses and log slip settlement.
          </p>
        </div>
        {canCreate ? (
          <Button onClick={() => setStartOpen(true)}>
            <IconPlus size={16} className="mr-1" /> Start Journey
          </Button>
        ) : null}
      </div>

      <JourneyTable
        data={journeys.data?.data ?? []}
        total={journeys.data?.meta?.total ?? 0}
        page={page}
        size={size}
        onPageChange={setPage}
        onSizeChange={(next) => {
          setSize(next);
          setPage(0);
        }}
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        startedFrom={startedFrom}
        onStartedFromChange={setStartedFrom}
        startedTo={startedTo}
        onStartedToChange={setStartedTo}
        sort={sort}
        onSortChange={setSort}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
        columnOrder={columnOrder}
        onColumnOrderChange={setColumnOrder}
        counts={counts.data ?? {}}
        isLoading={journeys.isLoading}
        onRowClick={(j) => router.push(`/vehicle-journeys/${j.id}`)}
      />

      <StartJourneyDialog open={startOpen} onOpenChange={setStartOpen} />
    </div>
  );
}
