"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { IconPlus } from "@tabler/icons-react";

import { useCan } from "@/features/auth";
import { useDebouncedValue } from "../masters/_shared/hooks/useDebouncedValue";
import type { ListQuery } from "../masters/_shared/master-api";

import { journeyApi } from "./journey.service";
import { journeyKeys } from "./journey.keys";
import JourneyTable from "./JourneyTable";
import StartJourneyDialog from "./StartJourneyDialog";

export default function VehicleJourneyListPage() {
  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(10);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [startOpen, setStartOpen] = React.useState(false);
  const debouncedSearch = useDebouncedValue(search);

  const canCreate = useCan(PERMS.VEHICLE_JOURNEY.CREATE);

  React.useEffect(() => setPage(0), [debouncedSearch, statusFilter]);

  const listQuery = React.useMemo<ListQuery>(
    () => ({
      page,
      size,
      ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
      ...(statusFilter !== "ALL" ? { filter: { status: statusFilter } } : {}),
    }),
    [page, size, debouncedSearch, statusFilter],
  );

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
        counts={counts.data ?? {}}
        isLoading={journeys.isLoading}
      />

      <StartJourneyDialog open={startOpen} onOpenChange={setStartOpen} />
    </div>
  );
}
