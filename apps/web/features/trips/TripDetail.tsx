"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  IconArrowLeft,
  IconBan,
  IconEdit,
  IconTrash,
  IconCircleCheck,
  IconTruckDelivery,
} from "@tabler/icons-react";

import { useCan } from "@/features/auth";
import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import ReasonDialog from "@/components/feedback/ReasonDialog";
import { formatMoney, formatDate, formatDateTime } from "@/lib/format";
import getErrorMessage from "../masters/_shared/hooks/useMasterMutation";

import { tripApi } from "./trip.service";
import { tripKeys } from "./trip.keys";
import { TripStatusBadge, TRIP_TYPE_LABELS } from "./trip-ui";
import CloseTripDialog from "./CloseTripDialog";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </span>
      <span className="text-sm">{value ?? "—"}</span>
    </div>
  );
}

export default function TripDetail({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [closeOpen, setCloseOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const canClose = useCan(PERMS.TRIP.CLOSE);
  const canCancel = useCan(PERMS.TRIP.CANCEL);
  const canDelete = useCan(PERMS.TRIP.DELETE);
  const canUpdate = useCan(PERMS.TRIP.UPDATE);
  const canCreateLR = useCan(PERMS.LORRY_RECEIPT.CREATE);

  const trip = useQuery({
    queryKey: tripKeys.detail(id),
    queryFn: () => tripApi.detail(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: tripKeys.all });
    queryClient.invalidateQueries({ queryKey: tripKeys.detail(id) });
  };

  const close = useMutation({
    mutationFn: (closingKm: number) => tripApi.close(id, { closingKm }),
    onSuccess: () => {
      toast.success("Trip closed");
      setCloseOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const cancel = useMutation({
    mutationFn: (reason: string) => tripApi.cancel(id, { reason }),
    onSuccess: () => {
      toast.success("Trip cancelled");
      setCancelOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: () => tripApi.delete(id),
    onSuccess: () => {
      toast.success("Trip deleted");
      setDeleteOpen(false);
      queryClient.invalidateQueries({ queryKey: tripKeys.all });
      router.push("/trips");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (trip.isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (trip.isError || !trip.data) {
    return (
      <div className="mx-auto max-w-4xl p-6 text-sm text-muted-foreground">
        Trip not found.
      </div>
    );
  }

  const t = trip.data;
  // A Planned trip is "started" by creating its LR — the LR attach flips it to
  // InTransit on the server. The button just routes to the Instant LR form.
  const startable = t.status === "Planned";
  const closeable = t.status === "InTransit";
  const editable = t.status === "Planned";
  const deletable = t.status === "Planned" || t.status === "Cancelled";
  const cancellable = t.status === "Planned" || t.status === "InTransit";
  const routeLabel = `${t.route?.sourceCity?.name ?? "?"} → ${
    t.route?.destinationCity?.name ?? "?"
  }`;

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={() => router.push("/trips")}>
            <IconArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{t.tripName}</h1>
            <p className="text-xs text-muted-foreground">{t.tripNumber}</p>
            <div className="mt-1">
              <TripStatusBadge status={t.status} />
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {canUpdate && editable ? (
            <Button variant="outline" onClick={() => router.push(`/trips/${t.id}/edit`)}>
              <IconEdit size={16} className="mr-1" /> Edit
            </Button>
          ) : null}
          {canCreateLR && startable ? (
            <Button
              onClick={() => router.push(`/lorry-receipts/new?tripId=${t.id}`)}
            >
              <IconTruckDelivery size={16} className="mr-1" /> Start trip
            </Button>
          ) : null}
          {canClose && closeable ? (
            <Button onClick={() => setCloseOpen(true)}>
              <IconCircleCheck size={16} className="mr-1" /> Close trip
            </Button>
          ) : null}
          {canCancel && cancellable ? (
            <Button
              variant="outline"
              className="text-red-600 hover:bg-red-50"
              onClick={() => setCancelOpen(true)}
            >
              <IconBan size={16} className="mr-1" /> Cancel
            </Button>
          ) : null}
          {canDelete && deletable ? (
            <Button
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <IconTrash size={16} className="mr-1" /> Delete
            </Button>
          ) : null}
        </div>
      </div>

      <section className="rounded-lg border bg-muted/20 p-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Vehicle" value={t.vehicle?.vehicleNumber} />
          <Field label="Driver" value={t.driver?.name} />
          <Field label="Route" value={routeLabel} />
          <Field label="Trip type" value={TRIP_TYPE_LABELS[t.tripType]} />
          {t.tripType === "lr" ? (
            <Field label="Client" value={t.consignor?.name ?? "—"} />
          ) : null}
          <Field label="Onward freight" value={formatMoney(t.onwardFreight)} />
          <Field label="Empty trip" value={t.isTripEmpty ? "Yes" : "No"} />
          {t.tripType === "dc" ? (
            <Field label="Rake date" value={formatDate(t.rakeDate)} />
          ) : null}
          <Field label="Opening KM" value={t.openingKm} />
          <Field label="Started at" value={formatDateTime(t.startDateTime)} />
          <Field label="Closing KM" value={t.closingKm ?? "—"} />
          <Field label="Ended at" value={formatDateTime(t.endDateTime)} />
          <Field
            label="Created by"
            value={
              t.createdBy
                ? `${t.createdBy.firstName} ${t.createdBy.lastName}`
                : "—"
            }
          />
          <Field label="Created at" value={formatDateTime(t.createdAt)} />
        </div>
      </section>

      {/* Status history timeline */}
      <section className="rounded-lg border bg-background p-4">
        <h3 className="mb-3 text-sm font-semibold">Status history</h3>
        {t.TripStatusHistory && t.TripStatusHistory.length > 0 ? (
          <ol className="space-y-3">
            {t.TripStatusHistory.map((h) => (
              <li key={h.id} className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div className="grid gap-0.5">
                  <div className="flex items-center gap-2">
                    <TripStatusBadge status={h.status} />
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(h.changedAt)}
                    </span>
                  </div>
                  {h.note ? (
                    <span className="text-sm text-muted-foreground">{h.note}</span>
                  ) : null}
                  {h.changedBy ? (
                    <span className="text-xs text-muted-foreground">
                      by {h.changedBy.firstName} {h.changedBy.lastName}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">No history yet.</p>
        )}
      </section>

      <CloseTripDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        tripNumber={t.tripNumber}
        openingKm={t.openingKm}
        isPending={close.isPending}
        onConfirm={(closingKm) => close.mutate(closingKm)}
      />

      <ReasonDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={`Cancel trip ${t.tripNumber}`}
        description="This can't be undone."
        confirmLabel="Cancel trip"
        destructive
        isPending={cancel.isPending}
        onConfirm={(reason) => cancel.mutate(reason)}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete trip ${t.tripNumber}`}
        description="This will permanently delete the trip. Use this only for wrong, duplicate, or cancelled trips."
        confirmLabel="Delete trip"
        pendingLabel="Deleting..."
        destructive
        isPending={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </div>
  );
}
