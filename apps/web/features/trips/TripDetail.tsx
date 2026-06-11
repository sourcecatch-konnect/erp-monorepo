"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { IconArrowLeft, IconEdit, IconTruckDelivery, IconBan } from "@tabler/icons-react";

import { useCan } from "@/features/auth";
import ReasonDialog from "@/components/feedback/ReasonDialog";
import { formatMoney, formatDate, formatDateTime } from "@/lib/format";
import getErrorMessage from "../masters/_shared/hooks/useMasterMutation";

import { tripApi } from "./trip.service";
import { tripKeys } from "./trip.keys";
import { TripStatusBadge, TRIP_TYPE_LABELS } from "./trip-ui";
import StartTripDialog from "./StartTripDialog";
import { useBreadcrumbLabels } from "@/components/layout/breadcrumb-labels";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm">{value ?? "—"}</span>
    </div>
  );
}

export default function TripDetail({ id }: { id: string }) {
  const { setLabel } = useBreadcrumbLabels();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [startOpen, setStartOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);

  const canUpdate = useCan(PERMS.TRIP.UPDATE);
  const canCancel = useCan(PERMS.TRIP.CANCEL);

  const trip = useQuery({
    queryKey: tripKeys.detail(id),
    queryFn: () => tripApi.detail(id),
  });

  // Register trip name as the breadcrumb label for this route segment
  React.useEffect(() => {
    if (trip.data?.tripName) {
      setLabel(`/trips/${id}`, trip.data.tripName);
    }
    return () => setLabel(`/trips/${id}`, null); // cleanup on unmount
  }, [id, trip.data?.tripName, setLabel]);


  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: tripKeys.all });
    queryClient.invalidateQueries({ queryKey: tripKeys.detail(id) });
  };

  const start = useMutation({
    mutationFn: (openingKm: number) => tripApi.start(id, { openingKm }),
    onSuccess: () => {
      toast.success("Trip started");
      setStartOpen(false);
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
  const startable = t.status === "Planned";
  const editable = t.status === "Planned";
  const cancellable = t.status === "Planned" || t.status === "InTransit";
  const routeLabel = `${t.route?.sourceCity?.name ?? "?"} → ${t.route?.destinationCity?.name ?? "?"
    }`;

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={() => router.push("/trips")}>
            <IconArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="text-sm font-semibold tracking-wider text-foreground">
              {t.tripName}
            </h1>
            <div className="mt-0.5 flex items-center gap-2">
              <p className="text-xs tracking-wide text-muted-foreground">
                {t.tripNumber}
              </p>
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
          {canUpdate && startable ? (
            <Button onClick={() => setStartOpen(true)}>
              <IconTruckDelivery size={16} className="mr-1" /> Start trip
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
          <Field label="Opening KM" value={t.openingKm ?? "—"} />
          <Field label="Started at" value={formatDateTime(t.startDateTime)} />
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

      <StartTripDialog
        open={startOpen}
        onOpenChange={setStartOpen}
        tripNumber={t.tripNumber}
        isPending={start.isPending}
        onConfirm={(openingKm) => start.mutate(openingKm)}
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
    </div>
  );
}
