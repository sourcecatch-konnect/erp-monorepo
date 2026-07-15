"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import type { CloseTripBody, Trip } from "@skerp/types";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import {
  IconBan,
  IconCircleCheck,
  IconClipboardList,
  IconPlus,
  IconTruckDelivery,
} from "@tabler/icons-react";

import { useCan } from "@/features/auth";
import { useTablePrefs } from "@/features/table-prefs";
import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import CloseTripDialog from "@/components/feedback/CloseTripDialog";
import ReasonDialog from "@/components/feedback/ReasonDialog";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "../masters/_shared/hooks/useDebouncedValue";
import getErrorMessage from "../masters/_shared/hooks/useMasterMutation";

import { tripApi } from "./trip.service";
import type { TripListQuery } from "./trip.service";
import { tripKeys } from "./trip.keys";
import TripTable, { DEFAULT_TRIP_COLUMN_ORDER } from "./TripTable";

/** Columns whose data is a relation join the server can skip when hidden. */
const RELATION_COLUMNS = ["journey", "vehicle", "route", "client"] as const;

function StatCard({
  label,
  value,
  icon: Icon,
  onClick,
  active,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg border bg-card p-4 text-left transition-colors",
        onClick && "hover:bg-muted/40",
        active && "border-primary",
      )}
    >
      <Icon size={20} className="shrink-0 text-muted-foreground" />
      <div>
        <div className="text-xl font-semibold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </button>
  );
}

const STAT_CARDS: {
  status: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
  { status: "Planned", label: "Planned", icon: IconClipboardList },
  { status: "InTransit", label: "In Transit", icon: IconTruckDelivery },
  { status: "Closed", label: "Closed", icon: IconCircleCheck },
  { status: "Cancelled", label: "Cancelled", icon: IconBan },
];

export default function TripsListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(10);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("InTransit");
  const [typeFilter, setTypeFilter] = React.useState("ALL");
  const [sort, setSort] = React.useState("createdAt:desc");
  const debouncedSearch = useDebouncedValue(search);

  // Per-user layout, persisted server-side (follows the account, not the
  // browser). Defaults render until the saved layout loads.
  const { columnVisibility, setColumnVisibility, columnOrder, setColumnOrder } =
    useTablePrefs("trips", DEFAULT_TRIP_COLUMN_ORDER);

  // Only ask the server to join relations for columns that are shown.
  const fields = RELATION_COLUMNS.filter(
    (col) => columnVisibility[col] !== false,
  ).join(",");

  const [closeTrip, setCloseTrip] = React.useState<Trip | null>(null);
  const [cancelTrip, setCancelTrip] = React.useState<Trip | null>(null);
  const [deleteTrip, setDeleteTrip] = React.useState<Trip | null>(null);
  const [dispatchTrip, setDispatchTrip] = React.useState<Trip | null>(null);

  const canCreate = useCan(PERMS.TRIP.CREATE);
  const canUpdate = useCan(PERMS.TRIP.UPDATE);
  const canClose = useCan(PERMS.TRIP.CLOSE);
  const canCancel = useCan(PERMS.TRIP.CANCEL);
  const canDelete = useCan(PERMS.TRIP.DELETE);
  const canCreateLR = useCan(PERMS.LORRY_RECEIPT.CREATE);
  const canDownloadPdf = useCan(PERMS.TRIP.VIEW);

  React.useEffect(
    () => setPage(0),
    [debouncedSearch, statusFilter, typeFilter],
  );

  const handleSizeChange = (nextSize: number) => {
    setSize(nextSize);
    setPage(0);
  };

  const listQuery = React.useMemo<TripListQuery>(
    () => ({
      page,
      size,
      sort,
      fields,
      ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
      filter: {
        ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
        ...(typeFilter !== "ALL" ? { tripType: typeFilter } : {}),
      },
    }),
    [page, size, sort, fields, debouncedSearch, statusFilter, typeFilter],
  );

  const trips = useQuery({
    queryKey: tripKeys.list(listQuery),
    queryFn: () => tripApi.list(listQuery),
    staleTime: 60_000,
    // Keep the previous rows on screen while a page/filter/column change
    // refetches — no skeleton flash between transitions.
    placeholderData: keepPreviousData,
  });

  const counts = useQuery({
    queryKey: tripKeys.statusCounts,
    queryFn: tripApi.statusCounts,
    staleTime: 0,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: tripKeys.all });
  };

  const dispatch = useMutation({
    mutationFn: (id: string) => tripApi.dispatch(id),
    onSuccess: () => {
      toast.success("Trip dispatched");
      setDispatchTrip(null);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const close = useMutation({
    mutationFn: (vars: { id: string; body: CloseTripBody }) =>
      tripApi.close(vars.id, vars.body),
    onSuccess: () => {
      toast.success("Trip closed");
      setCloseTrip(null);
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

  const remove = useMutation({
    mutationFn: (id: string) => tripApi.delete(id),
    onSuccess: () => {
      toast.success("Trip deleted");
      setDeleteTrip(null);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const handleDownloadPdf = async (trip: Trip) => {
    try {
      const blob = await tripApi.downloadPdf(trip.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `trip-${trip.tripNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download PDF");
    }
  };

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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map((card) => (
          <StatCard
            key={card.status}
            label={card.label}
            icon={card.icon}
            value={counts.data?.[card.status] ?? "…"}
            active={statusFilter === card.status}
            onClick={() =>
              setStatusFilter(
                statusFilter === card.status ? "ALL" : card.status,
              )
            }
          />
        ))}
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
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        sort={sort}
        onSortChange={setSort}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
        columnOrder={columnOrder}
        onColumnOrderChange={setColumnOrder}
        counts={counts.data ?? {}}
        isLoading={trips.isLoading}
        canStart={canCreateLR}
        canDispatch={canUpdate}
        canClose={canClose}
        canUpdate={canUpdate}
        canCancel={canCancel}
        canDelete={canDelete}
        onStart={(t) => router.push(`/lorry-receipts/new?tripId=${t.id}`)}
        onDispatch={(t) => setDispatchTrip(t)}
        onClose={(t) => setCloseTrip(t)}
        onCancel={(t) => setCancelTrip(t)}
        onDelete={(t) => setDeleteTrip(t)}
        canDownloadPdf={canDownloadPdf}
        onDownloadPdf={handleDownloadPdf}
        onRowClick={(t) => router.push(`/trips/${t.id}`)}
      />

      <CloseTripDialog
        open={Boolean(closeTrip)}
        onOpenChange={(open) => !open && setCloseTrip(null)}
        entity="trip"
        reference={closeTrip?.tripNumber}
        openingKm={closeTrip?.openingKm}
        isReturnToBase={closeTrip?.isReturnLeg}
        isPending={close.isPending}
        onConfirm={(body) => {
          if (closeTrip) close.mutate({ id: closeTrip.id, body });
        }}
      />

      <ConfirmDialog
        open={Boolean(dispatchTrip)}
        onOpenChange={(open) => !open && setDispatchTrip(null)}
        title={`Dispatch trip ${dispatchTrip?.tripNumber ?? ""}`}
        description="The trip moves to In Transit without an LR — use this for empty or rake (DC) legs. LR trips are dispatched by attaching an LR."
        confirmLabel="Dispatch"
        pendingLabel="Dispatching..."
        isPending={dispatch.isPending}
        onConfirm={() => {
          if (dispatchTrip) dispatch.mutate(dispatchTrip.id);
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

      <ConfirmDialog
        open={Boolean(deleteTrip)}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setDeleteTrip(null);
        }}
        title={`Delete trip ${deleteTrip?.tripNumber ?? ""}`}
        description="This will permanently delete the trip. Use this only for wrong, duplicate, or cancelled trips."
        confirmLabel="Delete trip"
        pendingLabel="Deleting..."
        destructive
        isPending={remove.isPending}
        onConfirm={() => {
          if (deleteTrip) remove.mutate(deleteTrip.id);
        }}
      />
    </div>
  );
}
