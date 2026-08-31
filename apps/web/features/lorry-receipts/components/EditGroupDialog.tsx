"use client";

import * as React from "react";
import { useForm, FormProvider, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { updateLRGroupSchema } from "@skerp/validators/lr-group";
import type { UpdateLRGroupBody, LRGroup } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";
import {
  SuggestInput,
  type SuggestOption,
} from "@skerp/ui/components/suggest-input";

import ComboboxField from "@/features/masters/_shared/fields/ComboboxField";
import { paiseToRupees } from "@/lib/money";
import { lrLookups, lrLookupKeys } from "../lorry-receipt.service";
import { FieldLabel, MoneyField } from "./moneyField";
import { branchApi } from "@/features/masters/branch/branch.service";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: LRGroup;
  isPending: boolean;
  onConfirm: (data: UpdateLRGroupBody) => void;
};

const TRANSPORT = [
  { value: "Road", label: "Road" },
  { value: "RoadAndRail", label: "Road & Rail" },
] as const;

const PRIORITY = [
  { value: "Normal", label: "Normal" },
  { value: "Express", label: "Express" },
  { value: "Critical", label: "Critical" },
] as const;

const PAYMENT_MODE = [
  { value: "TO_BE_BILLED", label: "To be Billed" },
  { value: "TO_PAY", label: "To Pay" },
] as const;

type DriverLookup = {
  name: string;
  mobile?: string | null;
  isAssigned?: boolean;
};

const toRupees = (value?: number | null) =>
  value == null ? undefined : paiseToRupees(Number(value));

const moneyNumber = (value: unknown) => {
  const amount = Number(String(value ?? "").trim() || 0);
  return Number.isFinite(amount) ? amount : 0;
};

function ReadOnlyAmount({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex h-9 items-center rounded-md bg-muted/30 px-3 text-sm font-semibold tabular-nums">
        ₹ {value.toFixed(2)}
      </div>
    </div>
  );
}

const editDefaults = (group: LRGroup): UpdateLRGroupBody => ({
  consigneeId: group.consigneeId,
  transportType: group.transportType,
  paymentMode: group.paymentMode,
  railheadBranchId: group.railheadBranchId ?? undefined,
  sourceRailheadAreaId: group.sourceRailheadAreaId ?? undefined,
  destinationRailheadAreaId: group.destinationRailheadAreaId ?? undefined,
  priority: group.priority,
  isMarketVehicle: group.isMarketVehicle,
  primaryTripId: group.primaryTripId ?? undefined,
  marketTransportId: group.marketTransportId ?? undefined,
  marketVehicleId: group.marketVehicleId ?? undefined,
  marketVehicleNumber: group.marketVehicleNumber ?? undefined,
  marketDriverName: group.marketDriverName ?? undefined,
  marketFreightAmount: toRupees(group.marketFreightAmount),
  marketAdvanceAmount: toRupees(group.marketAdvanceAmount),
  marketCommissionAmount: toRupees(group.marketCommissionAmount),
  marketHamaliAmount: toRupees(group.marketHamaliAmount),
  marketTdsAmount: toRupees(group.marketTdsAmount),
});

export default function EditGroupDialog({
  open,
  onOpenChange,
  group,
  isPending,
  onConfirm,
}: Props) {
  const customers = useQuery({
    queryKey: lrLookupKeys.customers,
    queryFn: lrLookups.customers,
    enabled: open,
  });
  const railheads = useQuery({
    queryKey: lrLookupKeys.railheadBranches,
    queryFn: lrLookups.railheadBranches,
    enabled: open,
  });
  const trips = useQuery({
    queryKey: lrLookupKeys.attachableTrips(group.consignorId),
    queryFn: () => lrLookups.attachableTrips(group.consignorId),
    enabled: open,
  });
  const transports = useQuery({
    queryKey: lrLookupKeys.transports,
    queryFn: lrLookups.transports,
    enabled: open,
  });
  const drivers = useQuery({
    queryKey: lrLookupKeys.drivers,
    queryFn: lrLookups.drivers,
    enabled: open,
  });

  const form = useForm<UpdateLRGroupBody>({
    resolver: zodResolver(updateLRGroupSchema, undefined, { raw: true }),
    defaultValues: editDefaults(group),
  });
  const watchedRailheadBranchId = form.watch("railheadBranchId");
  const sourceRailheadAreas = useQuery({
    queryKey: ["edit-lr-source-railheads", watchedRailheadBranchId ?? ""],
    queryFn: () => branchApi.railheads(watchedRailheadBranchId as string),
    enabled: open && Boolean(watchedRailheadBranchId),
  });
  const previousRailheadBranchRef = React.useRef(
    group.railheadBranchId ?? undefined,
  );
  React.useEffect(() => {
    if (!open) return;
    if (previousRailheadBranchRef.current === watchedRailheadBranchId) return;
    previousRailheadBranchRef.current = watchedRailheadBranchId;
    form.setValue("sourceRailheadAreaId", undefined, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [form, open, watchedRailheadBranchId]);
  const destinationRailheadAreas = useQuery({
    queryKey: ["edit-lr-destination-railheads", group.destinationBranchId],
    queryFn: () => branchApi.railheads(group.destinationBranchId),
    enabled: open && Boolean(group.destinationBranchId),
  });

  React.useEffect(() => {
    if (open) {
      previousRailheadBranchRef.current = group.railheadBranchId ?? undefined;
      form.reset(editDefaults(group));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isMarket = form.watch("isMarketVehicle");
  const transport = form.watch("transportType");
  const marketTransportId = form.watch("marketTransportId") ?? "";
  const marketVehicles = useQuery({
    queryKey: lrLookupKeys.marketVehicles(marketTransportId),
    queryFn: () => lrLookups.marketVehicles(marketTransportId),
    enabled: open && Boolean(isMarket && marketTransportId),
  });
  const errors = form.formState.errors;

  const customerOptions = customers.data ?? [];
  const tripOptions = (trips.data ?? []).map((t) => ({
    value: t.id,
    label: t.label,
    hint: t.hint,
    badge: t.badge,
  }));
  const marketVehicleSuggestions: SuggestOption[] = (
    marketVehicles.data ?? []
  ).map((vehicle) => ({
    value: vehicle.vehicleNumber,
    hint: vehicle.vehicleTypeRef.name,
    badge: "Registered",
    badgeTone: "muted",
  }));
  const driverSuggestions: SuggestOption[] = (
    (drivers.data ?? []) as DriverLookup[]
  ).map((driver) => ({
    value: driver.name,
    hint: driver.mobile ?? undefined,
    badge: driver.isAssigned ? "Assigned" : "Available",
    badgeTone: driver.isAssigned ? "warning" : "success",
  }));
  const totalFreightAdvance =
    moneyNumber(form.watch("marketAdvanceAmount")) +
    moneyNumber(form.watch("marketCommissionAmount")) +
    moneyNumber(form.watch("marketHamaliAmount")) +
    moneyNumber(form.watch("marketTdsAmount"));
  const netBalanceFreight =
    moneyNumber(form.watch("marketFreightAmount")) - totalFreightAdvance;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {group.lorryReceipts?.length === 1
              ? `Edit LR ${group.lorryReceipts[0]!.lrNumber}`
              : `Edit group ${group.groupNumber}`}
          </DialogTitle>
          <DialogDescription>
            Change the truck-level details. Add or remove LRs from the detail
            page.
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onConfirm)} className="space-y-4">
            <ComboboxField
              name="consigneeId"
              label="Consignee"
              options={customerOptions}
            />

            <div className="grid grid-cols-2 gap-3">
              <Controller
                name="transportType"
                control={form.control}
                render={({ field }) => (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Transport
                    </label>
                    <Select
                      value={field.value ?? "Road"}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TRANSPORT.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />
              <Controller
                name="priority"
                control={form.control}
                render={({ field }) => (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Priority
                    </label>
                    <Select
                      value={field.value ?? "Normal"}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />
              <Controller
                name="paymentMode"
                control={form.control}
                render={({ field }) => (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Payment mode
                    </label>
                    <Select
                      value={field.value ?? "TO_BE_BILLED"}
                      onValueChange={field.onChange}
                      disabled={group.status !== "DRAFT"}
                    >
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_MODE.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {group.status !== "DRAFT" ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Locked — group is no longer a draft.
                      </p>
                    ) : null}
                  </div>
                )}
              />
            </div>

            {transport === "RoadAndRail" && (
              <div className="grid gap-3 sm:grid-cols-3">
                <ComboboxField
                  name="railheadBranchId"
                  label="Source railway branch"
                  options={(railheads.data ?? []).map((b) => ({
                    value: b.value,
                    label: b.label,
                  }))}
                  emptyText="No railhead branches found"
                />
                <ComboboxField
                  name="sourceRailheadAreaId"
                  label="Source railhead"
                  options={(sourceRailheadAreas.data ?? []).map((item) => ({
                    value: item.area.id,
                    label: `${item.area.name} (${item.area.city.name})`,
                  }))}
                  emptyText="No mapped source railheads"
                />
                <ComboboxField
                  name="destinationRailheadAreaId"
                  label="Destination railhead"
                  options={(destinationRailheadAreas.data ?? []).map(
                    (item) => ({
                      value: item.area.id,
                      label: `${item.area.name} (${item.area.city.name})`,
                    }),
                  )}
                  emptyText="No mapped destination railheads"
                />
              </div>
            )}

            <Controller
              name="isMarketVehicle"
              control={form.control}
              render={({ field }) => (
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Transport by
                  </label>
                  <div className="inline-flex rounded-md border bg-muted/40 p-0.5">
                    {[
                      { value: false, label: "Own Vehicle" },
                      { value: true, label: "Market Vehicle" },
                    ].map((o) => (
                      <button
                        key={String(o.value)}
                        type="button"
                        onClick={() => {
                          field.onChange(o.value);

                          if (o.value) {
                            form.setValue("primaryTripId", undefined);
                            return;
                          }

                          form.setValue("marketTransportId", undefined);
                          form.setValue("marketVehicleId", undefined);
                          form.setValue("marketVehicleNumber", undefined);
                          form.setValue("marketDriverName", undefined);
                          form.setValue("marketFreightAmount", undefined);
                          form.setValue("marketAdvanceAmount", undefined);
                          form.setValue("marketCommissionAmount", undefined);
                          form.setValue("marketHamaliAmount", undefined);
                          form.setValue("marketTdsAmount", undefined);
                        }}
                        className={`rounded-[5px] px-3 py-1 text-xs font-medium transition-colors ${
                          field.value === o.value
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            />

            {!isMarket ? (
              <ComboboxField
                name="primaryTripId"
                label="Trip"
                options={tripOptions}
                emptyText="No trips available"
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <Controller
                  name="marketTransportId"
                  control={form.control}
                  render={({ field }) => (
                    <div>
                      <FieldLabel required>Transporter</FieldLabel>
                      <Select
                        value={field.value ?? ""}
                        onValueChange={(value) => {
                          field.onChange(value);
                          form.setValue("marketVehicleId", undefined, {
                            shouldValidate: true,
                          });
                          form.setValue("marketVehicleNumber", undefined, {
                            shouldValidate: true,
                          });
                        }}
                      >
                        <SelectTrigger
                          className="h-9 w-full"
                          aria-invalid={Boolean(
                            errors.marketTransportId?.message,
                          )}
                        >
                          <SelectValue
                            placeholder={
                              transports.isLoading
                                ? "Loading transporters..."
                                : "Select transporter"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {(transports.data ?? []).map((transporter) => (
                            <SelectItem
                              key={transporter.id}
                              value={transporter.id}
                            >
                              {transporter.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {typeof errors.marketTransportId?.message === "string" ? (
                        <p className="mt-1 text-xs text-red-600">
                          {errors.marketTransportId.message}
                        </p>
                      ) : null}
                    </div>
                  )}
                />

                <Controller
                  name="marketVehicleNumber"
                  control={form.control}
                  render={({ field }) => (
                    <div>
                      <FieldLabel required>Vehicle number</FieldLabel>
                      <SuggestInput
                        value={field.value ?? ""}
                        onChange={(value) => {
                          field.onChange(value);
                          const vehicle = (marketVehicles.data ?? []).find(
                            (row) =>
                              row.vehicleNumber.trim().toLowerCase() ===
                              value.trim().toLowerCase(),
                          );
                          form.setValue("marketVehicleId", vehicle?.id, {
                            shouldValidate: true,
                          });
                        }}
                        onBlur={field.onBlur}
                        suggestions={marketVehicleSuggestions}
                        disabled={!marketTransportId}
                        placeholder={
                          !marketTransportId
                            ? "Select transporter first"
                            : marketVehicles.isLoading
                              ? "Loading vehicles or type vehicle number"
                              : "Select or type vehicle number"
                        }
                        invalid={Boolean(errors.marketVehicleNumber?.message)}
                        className="[&_input]:h-9 [&_input]:uppercase"
                      />
                      {typeof errors.marketVehicleNumber?.message ===
                      "string" ? (
                        <p className="mt-1 text-xs text-red-600">
                          {errors.marketVehicleNumber.message}
                        </p>
                      ) : null}
                    </div>
                  )}
                />

                <Controller
                  name="marketDriverName"
                  control={form.control}
                  render={({ field }) => (
                    <div>
                      <FieldLabel>Driver (optional)</FieldLabel>
                      <SuggestInput
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        suggestions={driverSuggestions}
                        placeholder={
                          drivers.isLoading
                            ? "Loading drivers..."
                            : "Select or type driver"
                        }
                        invalid={Boolean(errors.marketDriverName?.message)}
                        className="[&_input]:h-9"
                      />
                    </div>
                  )}
                />

                <MoneyField<UpdateLRGroupBody>
                  name="marketFreightAmount"
                  label="Freight amount"
                />
                <MoneyField<UpdateLRGroupBody>
                  name="marketAdvanceAmount"
                  label="Advance amount"
                />
                <MoneyField<UpdateLRGroupBody>
                  name="marketCommissionAmount"
                  label="Commission"
                />
                <MoneyField<UpdateLRGroupBody>
                  name="marketHamaliAmount"
                  label="Hamali"
                />
                <MoneyField<UpdateLRGroupBody>
                  name="marketTdsAmount"
                  label="TDS"
                />
                <ReadOnlyAmount
                  label="Total Freight Advance"
                  value={totalFreightAdvance}
                />
                <ReadOnlyAmount
                  label="Net Balance Freight"
                  value={netBalanceFreight}
                />
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
