"use client";

import * as React from "react";
import { Controller, useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { addJourneyLegSchema } from "@skerp/validators";
import type {
  AddJourneyLegFormInput,
  AddJourneyLegBody,
  VehicleJourney,
  JourneyLeg,
} from "@skerp/types";
import { PERMS } from "@skerp/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { DateTimePicker } from "@skerp/ui/components/datetimepicker";

import { useCan } from "@/features/auth";
import { toValidDate } from "@/lib/date";
import ComboboxField from "../masters/_shared/fields/ComboboxField";
import IconTextField from "../masters/_shared/fields/IconTextField";
import SelectField from "../masters/_shared/fields/SelectField";
import CheckboxField from "../masters/_shared/fields/CheckBoxField";
import TextAreaField from "../masters/_shared/fields/TextAreaField";
import getErrorMessage from "../masters/_shared/hooks/useMasterMutation";
import RouteForm from "../masters/routes/routeForm";

import { journeyApi, journeyLookups } from "./journey.service";
import { journeyKeys, journeyLookupKeys } from "./journey.keys";
import { LEG_TYPE_LABELS, formatDateTime } from "./journey-ui";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  journey: VehicleJourney;
};

const LEG_TYPE_OPTIONS = Object.entries(LEG_TYPE_LABELS).map(
  ([value, label]) => ({ value, label }),
);

/** Last non-cancelled leg — the anchor for continuity suggestions. */
const previousLeg = (journey: VehicleJourney): JourneyLeg | null => {
  const legs = (journey.trips ?? []).filter((l) => l.status !== "Cancelled");
  return legs.length ? legs[legs.length - 1]! : null;
};

export default function AddLegDialog({ open, onOpenChange, journey }: Props) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = React.useState(false);
  const [routeFormOpen, setRouteFormOpen] = React.useState(false);
  const canOverride = useCan(PERMS.VEHICLE_JOURNEY.OVERRIDE_CHAIN);
  const canCreateRoute = useCan(PERMS.MASTERS.ROUTE.CREATE);

  const prev = previousLeg(journey);
  const suggestedOpeningKm =
    prev?.closingKm !== null && prev?.closingKm !== undefined
      ? prev.closingKm + 1
      : undefined;

  const routes = useQuery({
    queryKey: journeyLookupKeys.routes,
    queryFn: journeyLookups.routes,
    enabled: open,
  });
  const customers = useQuery({
    queryKey: journeyLookupKeys.customers,
    queryFn: journeyLookups.customers,
    enabled: open,
  });

  const form = useForm<AddJourneyLegFormInput, unknown, AddJourneyLegBody>({
    resolver: zodResolver(addJourneyLegSchema, undefined, { raw: true }),
    defaultValues: {
      legType: "LR",
      isTripEmpty: false,
      alreadyDispatched: false,
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        legType: "LR",
        isTripEmpty: false,
        alreadyDispatched: false,
        openingKm: suggestedOpeningKm,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const legType = form.watch("legType");
  const routeId = form.watch("routeId");
  const openingKm = form.watch("openingKm");
  const alreadyDispatched = form.watch("alreadyDispatched");

  const selectedRoute = (routes.data ?? []).find((r) => r.value === routeId);
  const breaksCity =
    Boolean(selectedRoute && prev?.toCityId) &&
    selectedRoute!.sourceCityId !== prev!.toCityId;
  const breaksKm =
    suggestedOpeningKm !== undefined &&
    openingKm !== undefined &&
    openingKm !== "" &&
    Number(openingKm) !== suggestedOpeningKm;
  const breaksChain = breaksCity || breaksKm;

  const onSubmit = async (values: AddJourneyLegBody) => {
    setSubmitting(true);
    try {
      const created = await journeyApi.addLeg(journey.id, values);
      toast.success(`Leg ${created.sequenceNo ?? ""} added`);
      queryClient.invalidateQueries({ queryKey: journeyKeys.all });
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Leg — {journey.journeyNumber}</DialogTitle>
            <DialogDescription>
              The next leg continues from where the previous leg ended.
            </DialogDescription>
          </DialogHeader>

          {prev ? (
            <div className="rounded-md border bg-muted/40 p-3 text-xs">
              <p>
                <span className="font-medium">Previous leg ended at:</span>{" "}
                {prev.toCity?.name ?? "—"}
                {prev.closingKm !== null ? ` · KM ${prev.closingKm}` : ""}
                {prev.endDateTime
                  ? ` · ${formatDateTime(prev.endDateTime)}`
                  : ""}
              </p>
              {suggestedOpeningKm !== undefined ? (
                <p className="mt-1 text-muted-foreground">
                  Suggested opening KM: {suggestedOpeningKm}
                </p>
              ) : null}
            </div>
          ) : null}

          <FormProvider {...form}>
            <form
              id="add-leg-form"
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
            >
              <div className="grid gap-3 md:grid-cols-2">
                <SelectField
                  name="legType"
                  label="Leg type"
                  required
                  options={LEG_TYPE_OPTIONS}
                />
                <ComboboxField
                  name="routeId"
                  label="Route"
                  required
                  options={routes.data ?? []}
                  actionLabel="+ Add route"
                  onAction={
                    canCreateRoute ? () => setRouteFormOpen(true) : undefined
                  }
                />
                {legType === "LR" ? (
                  <ComboboxField
                    name="consignorId"
                    label="Client"
                    required
                    options={customers.data ?? []}
                  />
                ) : null}
                {legType === "DC" ? (
                  <div className="grid gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Rake date <span className="text-red-600">*</span>
                    </label>
                    <Input type="date" {...form.register("rakeDate")} />
                  </div>
                ) : null}
                <IconTextField<AddJourneyLegFormInput>
                  name="onwardFreight"
                  label="Onward freight"
                  placeholder="0"
                  type="number"
                  min={0}
                  prefix="₹"
                  required
                />
                <IconTextField<AddJourneyLegFormInput>
                  name="openingKm"
                  label="Opening KM"
                  type="number"
                  min={1}
                  required
                  hint={
                    suggestedOpeningKm !== undefined
                      ? `Suggested: ${suggestedOpeningKm}`
                      : undefined
                  }
                />
                <Controller
                  name="startDateTime"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <div className="grid gap-1.5">
                      <DateTimePicker
                        label={
                          alreadyDispatched
                            ? "Actual dispatch date/time"
                            : "Planned start"
                        }
                        selected={toValidDate(field.value)}
                        onSelect={field.onChange}
                        placeholder={
                          alreadyDispatched
                            ? "Select the actual dispatch date and time"
                            : "Select planned start date and time"
                        }
                      />
                      {fieldState.error?.message ? (
                        <p className="text-xs text-red-600">
                          {fieldState.error.message}
                        </p>
                      ) : null}
                    </div>
                  )}
                />
                <div className="md:col-span-2">
                  <CheckboxField<AddJourneyLegFormInput>
                    control={form.control}
                    name="alreadyDispatched"
                    label="This leg's truck has already dispatched"
                  />
                </div>
                <div className="md:col-span-2">
                  <CheckboxField<AddJourneyLegFormInput>
                    control={form.control}
                    name="isTripEmpty"
                    label="This leg runs empty (no goods)"
                  />
                </div>
              </div>

              {breaksChain ? (
                <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
                  <p className="text-xs font-medium text-amber-700">
                    This leg breaks journey continuity:
                  </p>
                  <ul className="list-inside list-disc text-xs text-amber-700">
                    {breaksCity ? (
                      <li>
                        Route starts from {selectedRoute?.label.split(" → ")[0]}{" "}
                        but the previous leg ended at {prev?.toCity?.name}.
                      </li>
                    ) : null}
                    {breaksKm ? (
                      <li>
                        Opening KM differs from the expected{" "}
                        {suggestedOpeningKm}.
                      </li>
                    ) : null}
                  </ul>
                  {canOverride ? (
                    <TextAreaField<AddJourneyLegFormInput>
                      name="chainExceptionReason"
                      label="Exception reason"
                      required
                      placeholder="Why is continuity broken? (required to override)"
                    />
                  ) : (
                    <p className="text-xs text-destructive">
                      You don&apos;t have permission to override chain rules —
                      correct the route/KM or ask a supervisor.
                    </p>
                  )}
                </div>
              ) : null}
            </form>
          </FormProvider>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="add-leg-form"
              disabled={submitting || (breaksChain && !canOverride)}
            >
              {submitting ? "Adding…" : "Add Leg"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RouteForm
        open={routeFormOpen}
        onOpenChange={setRouteFormOpen}
        onSaved={async (route) => {
          await queryClient.invalidateQueries({
            queryKey: journeyLookupKeys.routes,
          });
          form.setValue("routeId", route.id, {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: true,
          });
        }}
      />
    </>
  );
}
