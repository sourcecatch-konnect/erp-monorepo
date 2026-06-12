"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Trip } from "@skerp/types";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { IconPlus } from "@tabler/icons-react";

import { useCan } from "@/features/auth";
import ReasonDialog from "@/components/feedback/ReasonDialog";
import { useDebouncedValue } from "../masters/_shared/hooks/useDebouncedValue";
import getErrorMessage from "../masters/_shared/hooks/useMasterMutation";
import type { ListQuery } from "../masters/_shared/master-api";

import { tripApi } from "./trip.service";
import { tripKeys } from "./trip.keys";
import TripTable from "./TripTable";
import StartTripDialog from "./StartTripDialog";

export default function TripsListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(10);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const debouncedSearch = useDebouncedValue(search);

  const [startTrip, setStartTrip] = React.useState<Trip | null>(null);
  const [cancelTrip, setCancelTrip] = React.useState<Trip | null>(null);

  const canCreate = useCan(PERMS.TRIP.CREATE);
  const canUpdate = useCan(PERMS.TRIP.UPDATE);
  const canCancel = useCan(PERMS.TRIP.CANCEL);

  React.useEffect(() => setPage(0), [debouncedSearch, statusFilter]);

  const handleSizeChange = (nextSize: number) => {
    setSize(nextSize);
    setPage(0);
  };

  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch, statusFilter]);

  const listQuery = React.useMemo<ListQuery>(
    () => ({
      page,
      size,
      ...(debouncedSearch.trim()
        ? { search: debouncedSearch.trim() }
        : {}),
      ...(statusFilter !== "ALL"
        ? { filter: { status: statusFilter } }
        : {}),
    }),
    [page, size, debouncedSearch, statusFilter]
  );

  const trips = useQuery({
    queryKey: tripKeys.list(listQuery),
    queryFn: () => tripApi.list(listQuery),
    staleTime: 60_000,
  });

  const counts = useQuery({
    queryKey: tripKeys.statusCounts,
    queryFn: tripApi.statusCounts,
    staleTime: 60_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: tripKeys.all });
  };

  const start = useMutation({
    mutationFn: (vars: { id: string; openingKm: number }) =>
      tripApi.start(vars.id, { openingKm: vars.openingKm }),
    onSuccess: () => {
      toast.success("Trip started");
      setStartTrip(null);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const cancel = useMutation({
    mutationFn: (vars: { id: string; reason: string }) =>
      tripApi.cancel(vars.id, { reason: vars.reason }),
    onSuccess: () => {
      toast.success("Trip cancelled");
      setCancelTrip(null);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Trips</h1>
        {canCreate ? (
          <Button onClick={() => router.push("/trips/new")}>
            <IconPlus size={16} className="mr-1" /> New Trip
          </Button>
        ) : null}
      </div>

      <TripTable
        data={trips.data?.data ?? []}
        total={trips.data?.meta?.total ?? 0}
        page={page}
        size={size}
        onPageChange={setPage}
        onSizeChange={handleSizeChange}
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        counts={counts.data ?? {}}
        isLoading={trips.isLoading}
        canUpdate={canUpdate}
        canCancel={canCancel}
        onStart={(t) => setStartTrip(t)}
        onCancel={(t) => setCancelTrip(t)}
      />


      <StartTripDialog
        open={Boolean(startTrip)}
        onOpenChange={(open) => !open && setStartTrip(null)}
        tripNumber={startTrip?.tripNumber}
        isPending={start.isPending}
        onConfirm={(openingKm) => {
          if (startTrip) start.mutate({ id: startTrip.id, openingKm });
        }}
      />

      <ReasonDialog
        open={Boolean(cancelTrip)}
        onOpenChange={(open) => !open && setCancelTrip(null)}
        title={`Cancel trip ${cancelTrip?.tripNumber ?? ""}`}
        description="This can't be undone."
        confirmLabel="Cancel trip"
        destructive
        isPending={cancel.isPending}
        onConfirm={(reason) => {
          if (cancelTrip) cancel.mutate({ id: cancelTrip.id, reason });
        }}
      />
    </div>
  );
}
