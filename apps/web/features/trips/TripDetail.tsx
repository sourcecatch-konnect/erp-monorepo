"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  PERMS,
  type CloseTripBody,
  type CorrectClosedTripBody,
  type CorrectInTransitTripBody,
  type Trip,
} from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@skerp/ui/components/dropdown";
import {
  IconArrowLeft,
  IconBan,
  IconCalendar,
  IconCircleCheck,
  IconClock,
  IconCurrencyRupee,
  IconDotsVertical,
  IconDownload,
  IconEdit,
  IconMapPinOff,
  IconPlayerPlay,
  IconRoad,
  IconRoute,
  IconTrash,
  IconTruckDelivery,
  IconWeight,
} from "@tabler/icons-react";

import { useCan } from "@/features/auth";
import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import CloseTripDialog from "@/components/feedback/CloseTripDialog";
import DispatchTripDialog from "@/components/feedback/DispatchTripDialog";
import ReasonDialog from "@/components/feedback/ReasonDialog";
import { useBreadcrumbLabels } from "@/components/layout/breadcrumb-labels";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import getErrorMessage from "../masters/_shared/hooks/useMasterMutation";

import { tripApi } from "./trip.service";
import { tripKeys } from "./trip.keys";
import CorrectClosedTripDialog from "./CorrectClosedTripDialog";
import CorrectInTransitTripDialog from "./CorrectInTransitTripDialog";
import {
  LegChip,
  timeAgo,
  TripCargoLine,
  TripStatusBadge,
  TripTypeChip,
  tripAttachesLR,
  tripDispatchesDirect,
  tripKmRun,
} from "./trip-ui";
import {
  CancelledBanner,
  CargoEmptyState,
  CloseBlockedBanner,
  DetailCard,
  DriverCard,
  Field,
  humanizeDuration,
  LRGroupCard,
  RouteHero,
  StatTile,
  StatusTimeline,
  tripBlockingLrNumbers,
  TripLifecycleStepper,
  UnloadingPointsCard,
  VehicleCard,
} from "./trip-detail-ui";

export default function TripDetail({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setLabel } = useBreadcrumbLabels();
  const [closeOpen, setCloseOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [dispatchOpen, setDispatchOpen] = React.useState(false);
  const [correctOpen, setCorrectOpen] = React.useState(false);
  const [correctInTransitOpen, setCorrectInTransitOpen] =
    React.useState(false);

  const canClose = useCan(PERMS.TRIP.CLOSE);
  const canCancel = useCan(PERMS.TRIP.CANCEL);
  const canDelete = useCan(PERMS.TRIP.DELETE);
  const canUpdate = useCan(PERMS.TRIP.UPDATE);
  const canCorrectClosed = useCan(PERMS.TRIP.CORRECT_CLOSED);
  const canCorrectInTransit = useCan(PERMS.TRIP.CORRECT_IN_TRANSIT);
  const canCreateLR = useCan(PERMS.LORRY_RECEIPT.CREATE);
  const canDispatch = canUpdate;

  const trip = useQuery({
    queryKey: tripKeys.detail(id),
    queryFn: () => tripApi.detail(id),
  });

  React.useEffect(() => {
    const href = `/trips/${encodeURIComponent(id)}`;
    setLabel(href, trip.data?.tripNumber ?? null);
    return () => setLabel(href, null);
  }, [id, setLabel, trip.data?.tripNumber]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: tripKeys.all });
    queryClient.invalidateQueries({ queryKey: tripKeys.detail(id) });
  };

  const dispatch = useMutation({
    mutationFn: (body: { startDateTime: Date }) => tripApi.dispatch(id, body),
    onSuccess: () => {
      toast.success("Trip dispatched");
      setDispatchOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const correctInTransit = useMutation({
    mutationFn: (body: CorrectInTransitTripBody) =>
      tripApi.correctInTransit(id, body),
    onSuccess: () => {
      toast.success("Trip start time corrected");
      setCorrectInTransitOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const close = useMutation({
    mutationFn: (body: CloseTripBody) => tripApi.close(id, body),
    onSuccess: () => {
      toast.success("Trip closed");
      setCloseOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const correctClosed = useMutation({
    mutationFn: (body: CorrectClosedTripBody) =>
      tripApi.correctClosed(id, body),
    onSuccess: () => {
      toast.success("Closed trip corrected");
      setCorrectOpen(false);
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

  const handleDownloadPdf = async (t: Trip) => {
    try {
      const blob = await tripApi.downloadPdf(t.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `trip-${t.tripNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download PDF");
    }
  };

  if (trip.isLoading) {
    return <DetailSkeleton />;
  }

  if (trip.isError || !trip.data) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 p-16 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-muted">
          <IconMapPinOff size={18} className="text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">Trip not found</p>
          <p className="text-sm text-muted-foreground">
            It may have been deleted, or the link is wrong.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/trips")}
        >
          <IconArrowLeft size={15} className="mr-1" /> Back to trips
        </Button>
      </div>
    );
  }

  const t = trip.data;
  // A Planned LR trip carrying goods is "started" by creating its LR — the LR
  // attach flips it to InTransit on the server. The button just routes to the
  // Instant LR form. DC/empty legs have no LR to attach, so they dispatch
  // directly instead — see tripAttachesLR / tripDispatchesDirect.
  const attachableLR = tripAttachesLR(t);
  const dispatchableDirect = tripDispatchesDirect(t);
  const closeable = t.status === "InTransit";
  const editable = t.status === "Planned";
  const isClosed = t.status === "Closed";
  const correctable =
    isClosed &&
    (!t.journey || ["ACTIVE", "RETURNED"].includes(t.journey.status));
  const deletable = t.status === "Planned" || t.status === "Cancelled";
  const cancellable = t.status === "Planned" || t.status === "InTransit";

  // Same "Way 1" gate the server enforces — disable Close and explain why.
  const blockingLrs = closeable ? tripBlockingLrNumbers(t) : [];
  const closeBlocked = blockingLrs.length > 0;

  const groups = [
    ...(t.primaryGroups ?? []).map((g) => ({
      group: g,
      leg: "primary" as const,
    })),
    ...(t.secondaryGroups ?? []).map((g) => ({
      group: g,
      leg: "secondary" as const,
    })),
  ];

  const km = tripKmRun(t);
  const started = t.startDateTime ? new Date(t.startDateTime).getTime() : null;
  const ended = t.endDateTime ? new Date(t.endDateTime).getTime() : null;
  const durationMs =
    started !== null
      ? (t.status === "InTransit" ? Date.now() : (ended ?? started)) - started
      : null;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      {/* ---- Header: route hero + badges + actions ---- */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            className="mt-0.5"
            onClick={() => router.push("/trips")}
          >
            <IconArrowLeft size={18} />
          </Button>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <RouteHero
                from={t.route?.sourceCity?.name}
                to={t.route?.destinationCity?.name}
              />
              <div className="flex items-center gap-1.5">
                <TripStatusBadge status={t.status} />
                <TripCargoLine trip={t} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="font-mono">{t.tripNumber}</span>
              <span className="mx-1.5">·</span>
              {t.tripName}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {canCreateLR && attachableLR ? (
            <Button
              onClick={() => router.push(`/lorry-receipts/new?tripId=${t.id}`)}
            >
              <IconTruckDelivery size={16} className="mr-1" /> Start trip
            </Button>
          ) : null}
          {canDispatch && dispatchableDirect ? (
            <Button onClick={() => setDispatchOpen(true)}>
              <IconPlayerPlay size={16} className="mr-1" /> Dispatch
            </Button>
          ) : null}
          {canClose && closeable ? (
            <Button
              disabled={closeBlocked}
              title={
                closeBlocked
                  ? "LRs on this trip are not delivered yet — see the notice below"
                  : undefined
              }
              onClick={() => setCloseOpen(true)}
            >
              <IconCircleCheck size={16} className="mr-1" /> Close trip
            </Button>
          ) : null}
          {canCorrectClosed && isClosed ? (
            <Button
              variant="outline"
              onClick={() => {
                if (correctable) {
                  setCorrectOpen(true);
                  return;
                }
                toast.error(
                  "This trip's settlement is locked. Reopen Settlement Review or Reopen Log Slip from the vehicle journey first.",
                );
              }}
            >
              <IconEdit size={16} className="mr-1" /> Correct Trip
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-sm" variant="ghost" aria-label="Trip actions">
                <IconDotsVertical size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {canUpdate && editable ? (
                <DropdownMenuItem asChild>
                  <Link href={`/trips/${t.id}/edit`}>
                    <IconEdit size={16} className="mr-2" /> Edit
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {canCorrectInTransit && t.status === "InTransit" ? (
                <DropdownMenuItem
                  onClick={() => setCorrectInTransitOpen(true)}
                >
                  <IconEdit size={16} className="mr-2" /> Edit start time
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onClick={() => handleDownloadPdf(t)}>
                <IconDownload size={16} className="mr-2" /> Download PDF
              </DropdownMenuItem>
              {canCancel && cancellable ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setCancelOpen(true)}
                  >
                    <IconBan size={16} className="mr-2" /> Cancel trip
                  </DropdownMenuItem>
                </>
              ) : null}
              {canDelete && deletable ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <IconTrash size={16} className="mr-2" /> Delete trip
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ---- Banners ---- */}
      {t.status === "Cancelled" ? (
        <CancelledBanner reason={t.cancelReason} />
      ) : null}
      {closeBlocked ? <CloseBlockedBanner lrNumbers={blockingLrs} /> : null}

      {/* ---- Lifecycle stepper ---- */}
      <DetailCard>
        <TripLifecycleStepper trip={t} />
      </DetailCard>

      {/* ---- Stat tiles ---- */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          icon={IconCurrencyRupee}
          label="Freight"
          value={
            Number(t.onwardFreight) > 0 ? formatPaise(t.onwardFreight) : "—"
          }
        />
        <StatTile
          icon={IconRoad}
          label="Distance"
          value={km !== null ? `${km.toLocaleString("en-IN")} km` : "—"}
          sub={
            t.closingKm !== null
              ? `${t.openingKm.toLocaleString("en-IN")} → ${t.closingKm.toLocaleString("en-IN")}`
              : `opened at ${t.openingKm.toLocaleString("en-IN")}`
          }
        />
        <StatTile
          icon={IconClock}
          label="Duration"
          value={durationMs !== null ? humanizeDuration(durationMs) : "—"}
          sub={t.status === "InTransit" ? "so far" : undefined}
        />
        <StatTile
          icon={IconWeight}
          label="Capacity"
          value={
            t.vehicle?.capacityMT != null ? `${t.vehicle.capacityMT} MT` : "—"
          }
          sub={t.vehicle?.bodyType ?? undefined}
        />
      </div>

      {/* ---- Two-column body ---- */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Cargo */}
          {groups.length > 0 ? (
            groups.map(({ group, leg }) => (
              <LRGroupCard key={group.id} group={group} leg={leg} />
            ))
          ) : (
            <CargoEmptyState trip={t} canCreateLR={canCreateLR} />
          )}

          {/* Trip facts */}
          <DetailCard title="Trip details" icon={IconCalendar}>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              <Field label="Type" value={<TripTypeChip type={t.tripType} />} />
              {t.tripType === "lr" ? (
                <Field label="Client" value={t.consignor?.name ?? "—"} />
              ) : null}
              {t.tripType === "dc" ? (
                <Field label="Rake date" value={formatDate(t.rakeDate)} />
              ) : null}
              <Field
                label="Started at"
                value={formatDateTime(t.startDateTime)}
              />
              <Field label="Ended at" value={formatDateTime(t.endDateTime)} />
              <Field
                label="Opening KM"
                value={t.openingKm.toLocaleString("en-IN")}
              />
              <Field
                label="Closing KM"
                value={t.closingKm?.toLocaleString("en-IN") ?? "—"}
              />
            </div>
          </DetailCard>

          {/* Unloading stops (mainly rake/DC trips) */}
          {t.TripUnloadingPoint && t.TripUnloadingPoint.length > 0 ? (
            <UnloadingPointsCard points={t.TripUnloadingPoint} />
          ) : null}
        </div>

        {/* ---- Side rail ---- */}
        <div className="space-y-4">
          {t.vehicle ? <VehicleCard vehicle={t.vehicle} /> : null}
          {t.driver ? <DriverCard driver={t.driver} /> : null}
          {t.journey ? (
            <DetailCard title="Journey" icon={IconRoute}>
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/vehicle-journeys/${t.journey.id}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {t.journey.journeyNumber}
                </Link>
                <LegChip
                  sequenceNo={t.sequenceNo}
                  isReturnLeg={t.isReturnLeg}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground capitalize">
                Journey status: {t.journey.status.toLowerCase()}
              </p>
            </DetailCard>
          ) : null}
          <DetailCard title="Status history" icon={IconClock}>
            <StatusTimeline history={t.TripStatusHistory ?? []} />
          </DetailCard>
        </div>
      </div>

      {/* ---- Meta footer ---- */}
      <p className="border-t pt-3 text-xs text-muted-foreground">
        Created
        {t.createdBy
          ? ` by ${t.createdBy.firstName} ${t.createdBy.lastName}`
          : ""}
        {" · "}
        {formatDateTime(t.createdAt)}
        {t.updatedAt && t.updatedAt !== t.createdAt
          ? ` · Updated ${timeAgo(t.updatedAt) ?? formatDateTime(t.updatedAt)}`
          : ""}
      </p>

      {/* ---- Dialogs ---- */}
      <DispatchTripDialog
        open={dispatchOpen}
        onOpenChange={setDispatchOpen}
        entity="trip"
        reference={t.tripNumber}
        isPending={dispatch.isPending}
        onConfirm={(body) => dispatch.mutate(body)}
      />

      <CorrectInTransitTripDialog
        open={correctInTransitOpen}
        onOpenChange={setCorrectInTransitOpen}
        trip={t}
        isPending={correctInTransit.isPending}
        onConfirm={(body) => correctInTransit.mutate(body)}
      />

      <CloseTripDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        entity="trip"
        reference={t.tripNumber}
        openingKm={t.openingKm}
        isReturnToBase={t.isReturnLeg}
        isPending={close.isPending}
        onConfirm={(body) => close.mutate(body)}
      />

      <CorrectClosedTripDialog
        open={correctOpen}
        onOpenChange={setCorrectOpen}
        trip={t}
        isPending={correctClosed.isPending}
        onConfirm={(body) => correctClosed.mutate(body)}
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

/** Loading state mirroring the real layout so nothing jumps on load. */
function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-7 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
      <Skeleton className="h-20 w-full rounded-lg" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
