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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { IconTruck, IconRoute, IconCalendar } from "@tabler/icons-react";

import FormSection from "../masters/_shared/fields/FormSection";
import ComboboxField from "../masters/_shared/fields/ComboboxField";
import IconTextField from "../masters/_shared/fields/IconTextField";
import CheckboxField from "../masters/_shared/fields/CheckBoxField";
import getErrorMessage from "../masters/_shared/hooks/useMasterMutation";

import { tripApi, tripLookups, tripLookupKeys } from "./trip.service";

type Props = {
  mode: "create" | "edit";
  trip?: Trip;
};

const dateValue = (iso?: string | null) =>
  iso ? new Date(iso) : undefined;

export default function TripForm({ mode, trip }: Props) {
  const router = useRouter();
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const vehicles = useQuery({
    queryKey: tripLookupKeys.ownVehicles,
    queryFn: tripLookups.ownVehicles,
  });
  const drivers = useQuery({
    queryKey: tripLookupKeys.drivers,
    queryFn: tripLookups.drivers,
  });
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
          onwardFreight: trip.onwardFreight ? Number(trip.onwardFreight) : undefined,
          isTripEmpty: trip.isTripEmpty,
          rakeDate: trip.rakeDate ?? undefined,
        }
      : {
          tripType: "lr",
          isTripEmpty: false,
        },
  });

  const tripType = form.watch("tripType");

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
                {mode === "edit" ? `Edit Trip ${trip?.tripNumber}` : "Create New Trip"}
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                {mode === "edit"
                  ? "Update trip details and save changes."
                  : "Plan a new trip for one of your own vehicles."}
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Save Trip"}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <FormSection icon={<IconTruck size={16} />} title="Vehicle & Driver" columns={2}>
            <ComboboxField
              name="vehicleId"
              label="Vehicle"
              required
              options={vehicles.data ?? []}
              emptyText="No own vehicles found"
            />
            <ComboboxField
              name="driverId"
              label="Driver"
              required
              options={drivers.data ?? []}
            />
          </FormSection>

          <FormSection icon={<IconRoute size={16} />} title="Trip Details" columns={2}>
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
