"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, FormProvider, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { createTripSchema } from "@skerp/validators";
import type { CreateTripFormInput, CreateTripBody, Trip } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { DatePicker } from "@skerp/ui/components/datepicker";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import {
  IconTruck,
  IconRoute,
  IconMapPin,
  IconHome,
  IconAlertTriangle,
  IconArrowRight,
  IconLock,
} from "@tabler/icons-react";

import FormSection from "../masters/_shared/fields/FormSection";
import ComboboxField from "../masters/_shared/fields/ComboboxField";
import IconTextField from "../masters/_shared/fields/IconTextField";
import CheckboxField from "../masters/_shared/fields/CheckBoxField";
import TextAreaField from "../masters/_shared/fields/TextAreaField";
import getErrorMessage from "../masters/_shared/hooks/useMasterMutation";

import {
  DriverComboboxField,
  VehicleComboboxField,
} from "@/components/lookups";
import { paiseToRupees } from "@/lib/money";
import { tripApi, tripLookups, tripLookupKeys } from "./trip.service";

type Props = {
  mode: "create" | "edit";
  trip?: Trip;
};

export default function TripForm({ mode, trip }: Props) {
  const router = useRouter();
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const isJourneyLegEdit = mode === "edit" && Boolean(trip?.journeyId);

  const routes = useQuery({
    queryKey: tripLookupKeys.routes,
    queryFn: tripLookups.routes,
  });
  const customers = useQuery({
    queryKey: tripLookupKeys.customers,
    queryFn: tripLookups.customers,
  });

  const form = useForm<CreateTripFormInput, unknown, CreateTripBody>({
    resolver: zodResolver(createTripSchema),
    defaultValues: trip
      ? {
          vehicleId: trip.vehicleId,
          driverId: trip.driverId,
          routeId: trip.routeId,
          tripType: trip.tripType,
          consignorId: trip.consignorId ?? undefined,
          // Stored as paise; the form edits rupees.
          onwardFreight: trip.onwardFreight
            ? paiseToRupees(Number(trip.onwardFreight))
            : undefined,
          openingKm: trip.openingKm,
          isTripEmpty: trip.isTripEmpty,
          rakeDate: trip.rakeDate ?? undefined,
          chainExceptionReason: trip.chainExceptionReason ?? undefined,
        }
      : {
          tripType: "lr",
          isTripEmpty: false,
        },
  });

  const tripType = form.watch("tripType");
  const vehicleId = form.watch("vehicleId");
  const routeId = form.watch("routeId");
  const openingKmRaw = form.watch("openingKm");

  /* -------------------------------------------------------------- */
  /* Journey context — every trip attaches to its vehicle's journey */
  /* -------------------------------------------------------------- */

  // Only the create flow previews the attach; editing a leg keeps its slot.
  const journeyInfo = useQuery({
    queryKey: tripLookupKeys.activeJourney(vehicleId ?? ""),
    queryFn: () => tripApi.activeJourney(vehicleId!),
    enabled: mode === "create" && Boolean(vehicleId),
    staleTime: 15_000,
  });
  const info = mode === "create" ? journeyInfo.data : undefined;
  const journey = info?.journey ?? null;
  const lastLeg = journey?.lastLeg ?? null;

  // The journey's driver stays for the whole cycle — lock the field.
  React.useEffect(() => {
    if (journey?.driverId) {
      form.setValue("driverId", journey.driverId, { shouldValidate: true });
    }
  }, [journey?.driverId, form]);

  // Suggest the continuous opening KM (previous closing + 1) when empty.
  React.useEffect(() => {
    if (
      journey &&
      lastLeg?.closingKm != null &&
      (openingKmRaw === undefined || openingKmRaw === "")
    ) {
      form.setValue("openingKm", lastLeg.closingKm + 1, { shouldDirty: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journey?.id, lastLeg?.closingKm]);

  const selectedRoute = React.useMemo(
    () => (routes.data ?? []).find((r) => r.value === routeId) ?? null,
    [routes.data, routeId],
  );

  const openingKm = Number(openingKmRaw);

  // Mirror the server's chain rules so breaks surface before submit.
  const chainWarnings = React.useMemo(() => {
    if (mode !== "create" || !info) return [];
    const warnings: string[] = [];
    if (journey) {
      if (
        lastLeg?.toCityId &&
        selectedRoute?.sourceCityId &&
        selectedRoute.sourceCityId !== lastLeg.toCityId
      ) {
        warnings.push(
          `Route starts from ${selectedRoute.sourceCityName ?? "?"} but the truck is at ${lastLeg.toCityName ?? "?"}.`,
        );
      }
      if (
        lastLeg?.closingKm != null &&
        Number.isInteger(openingKm) &&
        openingKm > 0 &&
        openingKm !== lastLeg.closingKm + 1
      ) {
        warnings.push(
          `Opening KM breaks continuity — expected ${lastLeg.closingKm + 1} (previous closing KM + 1).`,
        );
      }
    } else if (
      selectedRoute?.sourceCityId &&
      selectedRoute.sourceCityId !== info.headOffice.cityId
    ) {
      warnings.push(
        `New journeys start from ${info.headOffice.cityName} (head office); this route starts from ${selectedRoute.sourceCityName ?? "?"}.`,
      );
    }
    return warnings;
  }, [mode, info, journey, lastLeg, selectedRoute, openingKm]);

  const prevLegOpen = Boolean(lastLeg && lastLeg.status !== "Closed");
  const showExceptionReason =
    (mode === "create" && chainWarnings.length > 0) || isJourneyLegEdit;

  const isReturnLeg = Boolean(
    journey &&
      selectedRoute?.destinationCityId &&
      selectedRoute.destinationCityId === journey.returnCityId,
  );

  const onSubmit = async (values: CreateTripBody) => {
    setSubmitting(true);
    try {
      if (mode === "edit" && trip) {
        await tripApi.update(trip.id, { ...values, version: trip.version });
        toast.success("Trip updated");
        router.push(`/trips/${trip.id}`);
      } else {
        const created = await tripApi.create(values);
        toast.success(`Trip ${created.tripNumber} created`);
        router.push(`/trips/${created.id}`);
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (form.formState.isDirty) setDiscardOpen(true);
    else router.push("/trips");
  };

  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="mx-auto max-w-4xl space-y-5 p-4 md:p-6"
      >
        <div className="rounded-lg border bg-background p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                {mode === "edit"
                  ? `Edit Trip ${trip?.tripNumber}`
                  : "Create New Trip"}
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                {mode === "edit"
                  ? "Update trip details and save changes."
                  : "Every trip joins its vehicle's journey — as the next leg, or by opening a new journey from head office."}
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || prevLegOpen}>
                {submitting ? "Saving…" : "Save Trip"}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <FormSection
            icon={<IconTruck size={16} />}
            title="Vehicle & Driver"
            columns={2}
          >
            <VehicleComboboxField<CreateTripFormInput>
              name="vehicleId"
              label="Vehicle"
              required
              emptyText="No own vehicles found"
              disabled={isJourneyLegEdit}
            />
            <DriverComboboxField<CreateTripFormInput>
              name="driverId"
              label={journey ? "Driver (journey driver)" : "Driver"}
              required
              disabled={Boolean(journey) || isJourneyLegEdit}
              highlightDriverId={journey?.driverId}
            />

            {/* Journey context — appears once a vehicle is picked */}
            {mode === "create" && vehicleId ? (
              <div className="col-span-full">
                {journeyInfo.isLoading ? (
                  <div className="rounded-md border p-3">
                    <Skeleton className="h-4 w-64" />
                    <Skeleton className="mt-2 h-3 w-40" />
                  </div>
                ) : journey ? (
                  <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <IconRoute size={15} className="text-primary" />
                      <span className="text-sm font-medium">
                        Journey {journey.journeyNumber}
                      </span>
                      <IconArrowRight
                        size={13}
                        className="text-muted-foreground"
                      />
                      <span className="text-sm">
                        this trip becomes{" "}
                        <span className="font-semibold">
                          leg {(lastLeg?.sequenceNo ?? 0) + 1}
                        </span>
                        {isReturnLeg ? " — the return to base" : ""}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {lastLeg ? (
                        <span className="inline-flex items-center gap-1">
                          <IconMapPin size={12} />
                          Truck at {lastLeg.toCityName ?? "?"}
                          {lastLeg.closingKm != null
                            ? ` · closing KM ${lastLeg.closingKm.toLocaleString("en-IN")}`
                            : ""}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1">
                        <IconHome size={12} />
                        Returns at {journey.returnCityName ?? "?"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <IconLock size={12} />
                        Driver locked to {journey.driverName ?? "journey driver"}
                      </span>
                    </div>
                    {prevLegOpen ? (
                      <p className="mt-2 flex items-start gap-1.5 rounded-md bg-destructive/10 px-2 py-1.5 text-xs font-medium text-destructive">
                        <IconAlertTriangle size={14} className="mt-0.5 shrink-0" />
                        Leg {lastLeg?.sequenceNo} is still{" "}
                        {lastLeg?.status === "InTransit"
                          ? "in transit"
                          : "planned"}{" "}
                        — close it before adding the next leg.
                      </p>
                    ) : null}
                  </div>
                ) : info ? (
                  <div className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <IconHome size={15} className="text-primary" />
                      <span className="text-sm font-medium">New journey</span>
                      <span className="text-sm text-muted-foreground">
                        — opens automatically with this trip as leg 1, based at{" "}
                        {info.headOffice.cityName} (head office)
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {isJourneyLegEdit && trip?.journey ? (
              <div className="col-span-full rounded-md border border-primary/30 bg-primary/5 p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <IconRoute size={15} className="text-primary" />
                  <span className="font-medium">
                    Leg {trip.sequenceNo} of journey {trip.journey.journeyNumber}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Vehicle and driver stay with the journey — cancel the trip
                    to change them.
                  </span>
                </div>
              </div>
            ) : null}
          </FormSection>

          <FormSection
            icon={<IconRoute size={16} />}
            title="Trip Details"
            columns={2}
          >
            <ComboboxField
              name="routeId"
              label="Route"
              required
              options={routes.data ?? []}
            />

            <IconTextField<CreateTripFormInput>
              name="onwardFreight"
              label="Onward freight"
              placeholder="0"
              type="number"
              min={0}
              prefix="₹"
              required
            />

            <IconTextField<CreateTripFormInput>
              name="openingKm"
              label="Opening KM"
              placeholder={
                lastLeg?.closingKm != null
                  ? `${lastLeg.closingKm + 1} (previous closing + 1)`
                  : "e.g. 145200"
              }
              type="number"
              min={1}
              required
            />

            {/* Trip type toggle */}
            <div className="col-span-full grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Trip type <span className="text-red-600">*</span>
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                {(["lr", "dc"] as const).map((t) => {
                  const active = tripType === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() =>
                        form.setValue("tripType", t, { shouldDirty: true })
                      }
                      className={[
                        "rounded-lg border p-4 text-left transition",
                        active
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "bg-background hover:bg-muted/40",
                      ].join(" ")}
                    >
                      <p className="text-sm font-medium">
                        {t === "lr" ? "LR" : "Rake (DC)"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t === "lr"
                          ? "Road consignment trip carrying lorry receipts."
                          : "Rail rake / DC trip — requires a rake date."}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {tripType === "lr" ? (
              <ComboboxField
                name="consignorId"
                label="Client"
                required
                options={customers.data ?? []}
              />
            ) : null}

            {tripType === "dc" ? (
              <Controller
                control={form.control}
                name="rakeDate"
                render={({ field }) => (
                  <div className="grid gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Rake date <span className="text-red-600">*</span>
                    </label>
                    <DatePicker
                      selected={
                        field.value
                          ? field.value instanceof Date
                            ? field.value
                            : new Date(field.value)
                          : undefined
                      }
                      onSelect={(date) => field.onChange(date)}
                    />
                    {form.formState.errors.rakeDate?.message ? (
                      <p className="text-xs text-red-600">
                        {String(form.formState.errors.rakeDate.message)}
                      </p>
                    ) : null}
                  </div>
                )}
              />
            ) : null}

            <div className="col-span-full">
              <CheckboxField<CreateTripFormInput>
                control={form.control}
                name="isTripEmpty"
                label="This is an empty trip (no goods)"
              />
            </div>

            {/* Chain continuity warnings + exception reason */}
            {mode === "create" && chainWarnings.length > 0 ? (
              <div className="col-span-full rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                  <IconAlertTriangle size={14} /> This trip breaks journey
                  continuity
                </p>
                <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs text-amber-800">
                  {chainWarnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
                <p className="mt-1.5 text-xs text-amber-700">
                  Give a reason below — saving also needs the chain-override
                  permission.
                </p>
              </div>
            ) : null}

            {showExceptionReason ? (
              <div className="col-span-full">
                <TextAreaField<CreateTripFormInput>
                  name="chainExceptionReason"
                  label="Chain exception reason"
                  placeholder="Why does this trip break the journey chain? (e.g. odometer replaced, repositioned by rail)"
                  rows={2}
                  maxLength={500}
                />
              </div>
            ) : null}
          </FormSection>
        </div>
      </form>

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard unsaved changes?</DialogTitle>
            <DialogDescription>
              You have unsaved changes that will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardOpen(false)}>
              Keep editing
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => router.push("/trips")}
            >
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FormProvider>
  );
}
