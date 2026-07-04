"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { IconPlus } from "@tabler/icons-react";
import Link from "next/link";

import { useCan } from "@/features/auth";
import { useDebouncedValue } from "../masters/_shared/hooks/useDebouncedValue";
import type { ListQuery } from "../masters/_shared/master-api";

import { journeyApi } from "./journey.service";
import { journeyKeys } from "./journey.keys";
import JourneyCardList from "./JourneyCardList";

export default function VehicleJourneyListPage() {
  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(10);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const debouncedSearch = useDebouncedValue(search);

  const canCreateTrip = useCan(PERMS.TRIP.CREATE);

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
            Full truck cycles — every trip attaches to its vehicle&apos;s
            journey automatically. Create trips from the Trips page.
          </p>
        </div>
        {canCreateTrip ? (
          <Button asChild>
            <Link href="/trips/new">
              <IconPlus size={16} className="mr-1" /> New Trip
            </Link>
          </Button>
        ) : null}
      </div>

      <JourneyCardList
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
    </div>
  );
}
