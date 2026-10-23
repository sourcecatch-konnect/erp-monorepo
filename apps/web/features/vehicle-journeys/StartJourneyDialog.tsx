"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { startJourneySchema } from "@skerp/validators";
import {
  PERMS,
  type StartJourneyFormInput,
  type StartJourneyBody,
} from "@skerp/types";
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

import ComboboxField from "../masters/_shared/fields/ComboboxField";
import IconTextField from "../masters/_shared/fields/IconTextField";
import SelectField from "../masters/_shared/fields/SelectField";
import CheckboxField from "../masters/_shared/fields/CheckBoxField";
import getErrorMessage from "../masters/_shared/hooks/useMasterMutation";
import RouteForm from "../masters/routes/routeForm";
import { toValidDate } from "@/lib/date";
import { useCan } from "@/features/auth";
import VehicleComboboxField from "@/components/lookups/VehicleComboboxField";
import DriverComboboxField from "@/components/lookups/DriverComboboxField";

import { journeyApi, journeyLookups } from "./journey.service";
import { journeyKeys, journeyLookupKeys } from "./journey.keys";
import { LEG_TYPE_LABELS } from "./journey-ui";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const LEG_TYPE_OPTIONS = Object.entries(LEG_TYPE_LABELS).map(
  ([value, label]) => ({ value, label }),
);

/** Collect nested RHF error messages into a flat list for the summary strip. */
const flattenErrors = (node: unknown, out: string[] = []): string[] => {
  if (!node || typeof node !== "object") return out;
  const rec = node as Record<string, unknown>;
  if (typeof rec.message === "string" && rec.message) out.push(rec.message);
  for (const value of Object.values(rec)) {
    if (value && typeof value === "object") flattenErrors(value, out);
  }
  return out;
};

export default function StartJourneyDialog({ open, onOpenChange }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = React.useState(false);
  const [routeFormOpen, setRouteFormOpen] = React.useState(false);
  const canCreateRoute = useCan(PERMS.MASTERS.ROUTE.CREATE);

  const vehicles = useQuery({
    queryKey: journeyLookupKeys.ownVehicles,
    queryFn: journeyLookups.ownVehicles,
    enabled: open,
  });
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
  const cities = useQuery({
    queryKey: journeyLookupKeys.cities,
    queryFn: journeyLookups.cities,
    enabled: open,
  });
  const branches = useQuery({
    queryKey: journeyLookupKeys.branches,
    queryFn: journeyLookups.branches,
    enabled: open,
  });

  const form = useForm<StartJourneyFormInput, unknown, StartJourneyBody>({
    resolver: zodResolver(startJourneySchema, undefined, { raw: true }),
    defaultValues: {
      firstLeg: { legType: "LR", isTripEmpty: false },
    },
  });

  React.useEffect(() => {
    if (open) form.reset({ firstLeg: { legType: "LR", isTripEmpty: false } });
  }, [open, form]);

  const legType = form.watch("firstLeg.legType");
  const routeId = form.watch("firstLeg.routeId");
  const openingKm = form.watch("openingKm");
  const vehicleId = form.watch("vehicleId");

  // The server rejects a journey whose opening KM is below the vehicle's
  // odometer — mirror that check on blur so it doesn't surface at save time.
  const vehicleCurrentKm =
    (vehicles.data ?? []).find((v) => v.value === vehicleId)?.currentKM ?? null;

  const openingKmBelowCurrent = (value: unknown): boolean => {
    const km = Number(value);
    return (
      vehicleCurrentKm != null &&
      Number.isFinite(km) &&
      km > 0 &&
      km < vehicleCurrentKm
    );
  };

  const validateOpeningKm = (): boolean => {
    if (openingKmBelowCurrent(form.getValues("openingKm"))) {
      form.setError("openingKm", {
        type: "belowCurrentKm",
        message: `Below the vehicle's current KM — enter ${vehicleCurrentKm!.toLocaleString("en-IN")} or more.`,
      });
      return false;
    }
    if (form.formState.errors.openingKm?.type === "belowCurrentKm") {
      form.clearErrors("openingKm");
    }
    return true;
  };

  // Clear the below-current-KM error as soon as the value becomes valid
  // (typing a higher number or picking another vehicle).
  React.useEffect(() => {
    if (
      form.formState.errors.openingKm?.type === "belowCurrentKm" &&
      !openingKmBelowCurrent(openingKm)
    ) {
      form.clearErrors("openingKm");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openingKm, vehicleCurrentKm]);

  // Leg 1 always opens at the journey's opening KM.
  React.useEffect(() => {
    form.setValue("firstLeg.openingKm", openingKm ?? 0);
  }, [openingKm, form]);

  // The first leg must start from the journey's start city — derive it.
  React.useEffect(() => {
    if (!routeId) return;
    const route = (routes.data ?? []).find((r) => r.value === routeId);
    if (route?.sourceCityId) {
      form.setValue("startCityId", route.sourceCityId, {
        shouldValidate: true,
      });
    }
  }, [routeId, routes.data, form]);

  const onSubmit = async (values: StartJourneyBody) => {
    if (!validateOpeningKm()) return;
    setSubmitting(true);
    try {
      const created = await journeyApi.start(values);
      toast.success(`Journey ${created.journeyNumber} started`);
      queryClient.invalidateQueries({ queryKey: journeyKeys.all });
      onOpenChange(false);
      router.push(`/vehicle-journeys/${created.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const errorMessages = flattenErrors(form.formState.errors);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Start Journey</DialogTitle>
            <DialogDescription>
              Open a new truck cycle. The first leg is created with the journey;
              add further legs as the vehicle moves.
            </DialogDescription>
          </DialogHeader>

          <FormProvider {...form}>
            <form
              id="start-journey-form"
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-5"
            >
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Vehicle & Driver</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <VehicleComboboxField<StartJourneyFormInput>
                    name="vehicleId"
                    label="Vehicle"
                    required
                    selectionContext="journey"
                    emptyText="No own vehicles found"
                  />
                  <DriverComboboxField<StartJourneyFormInput>
                    name="driverId"
                    label="Driver"
                    required
                    selectionContext="journey"
                  />
                  <ComboboxField
                    name="homeBranchId"
                    label="Home branch"
                    required
                    options={branches.data ?? []}
                  />
                  <IconTextField<StartJourneyFormInput>
                    name="openingKm"
                    label="Opening KM"
                    placeholder={
                      vehicleCurrentKm != null
                        ? `${vehicleCurrentKm} or more`
                        : "e.g. 145200"
                    }
                    hint={
                      vehicleCurrentKm != null
                        ? `Vehicle's current KM: ${vehicleCurrentKm.toLocaleString("en-IN")} — opening KM can't be below this.`
                        : undefined
                    }
                    type="number"
                    min={1}
                    required
                    onBlur={() => validateOpeningKm()}
                  />
                  <Controller
                    name="startedAt"
                    control={form.control}
                    render={({ field }) => (
                      <DateTimePicker
                        label="Start date/time"
                        selected={toValidDate(field.value)}
                        onSelect={field.onChange}
                        placeholder="Select journey start date and time"
                      />
                    )}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold">First Leg</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <SelectField
                    name="firstLeg.legType"
                    label="Leg type"
                    required
                    options={LEG_TYPE_OPTIONS}
                  />
                  <ComboboxField
                    name="firstLeg.routeId"
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
                      name="firstLeg.consignorId"
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
                      <Input
                        type="date"
                        {...form.register("firstLeg.rakeDate")}
                      />
                    </div>
                  ) : null}
                  <IconTextField<StartJourneyFormInput>
                    name="firstLeg.onwardFreight"
                    label="Onward freight"
                    placeholder="0"
                    type="number"
                    min={0}
                    prefix="₹"
                    required
                  />
                  <div className="md:col-span-2">
                    <CheckboxField<StartJourneyFormInput>
                      control={form.control}
                      name="firstLeg.isTripEmpty"
                      label="This leg runs empty (no goods)"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Base / Return Rule</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <ComboboxField
                    name="startCityId"
                    label="Start city (from first leg route)"
                    required
                    options={cities.data ?? []}
                    disabled
                  />
                  <ComboboxField
                    name="returnCityId"
                    label="Return city (journey closes here)"
                    required
                    options={cities.data ?? []}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  The journey is marked returned when a leg closes at the return
                  city. Closing anywhere else needs a supervisor override.
                </p>
              </div>

              {errorMessages.length > 0 ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  {errorMessages.map((message, index) => (
                    <p key={index} className="text-xs text-destructive">
                      {message}
                    </p>
                  ))}
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
              form="start-journey-form"
              disabled={submitting}
            >
              {submitting ? "Starting…" : "Start Journey"}
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
          form.setValue("firstLeg.routeId", route.id, {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: true,
          });
        }}
      />
    </>
  );
}
