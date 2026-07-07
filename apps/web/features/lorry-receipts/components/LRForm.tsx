"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  useForm,
  FormProvider,
  useFieldArray,
  useWatch,
  Controller,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  IconPlus,
  IconTrash,
  IconTruck,
  IconUsers,
  IconPackage,
  IconRoute,
} from "@tabler/icons-react";

import { createLRGroupSchema } from "@skerp/validators/lr-group";
import type {
  CreateLRGroupFormInput,
  CreateLRGroupBody,
  Trip,
} from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";
import { SuggestInput } from "@skerp/ui/components/suggest-input";

import FormSection from "@/features/masters/_shared/fields/FormSection";
import ComboboxField from "@/features/masters/_shared/fields/ComboboxField";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";

import { lrGroupApi } from "../lr-group.service";
import { lrLookups, lrLookupKeys } from "../lorry-receipt.service";
import LRCreateSummary from "./LRCreateSummary";
import CreateTripDialog from "@/features/trips/CreateTripDialog";

type Props = {
  orderId?: string;
  /** Instant group launched from a Planned trip — preselects that trip. */
  tripId?: string;
};

const EMPTY_LINE = {
  loadingLocationId: undefined as string | undefined,
  unloadingLocationId: undefined as string | undefined,
  goods: [
    {
      name: "",
      description: "",
      quantity: "" as unknown as number,
      unit: "",
      weight: "" as unknown as number,
    },
  ],
};

const TRANSPORT_OPTIONS = [
  { value: "Road", label: "Road" },
  { value: "RoadAndRail", label: "Road & Rail" },
] as const;

const PRIORITY_OPTIONS = [
  { value: "Normal", label: "Normal" },
  { value: "Express", label: "Express" },
  { value: "Critical", label: "Critical" },
] as const;

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="mb-1 block text-xs font-medium text-muted-foreground">
      {children}
      {required && <span className="ml-0.5 text-red-600">*</span>}
    </label>
  );
}
function ReadOnlyAmount({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>

      <div className="  px-3 py-2">
        <div
          className={`text-sm ${
            strong
              ? "font-semibold text-foreground"
              : "font-medium text-foreground"
          }`}
        >
          ₹ {value.toFixed(2)}
        </div>
      </div>
    </div>
  );
}
function Segmented<T extends string | boolean>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-md border bg-muted/40 p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-[5px] px-3 py-1 text-xs font-medium transition-colors ${
            value === o.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function LRForm({ orderId, tripId }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = React.useState(false);
  const [createTripOpen, setCreateTripOpen] = React.useState(false);

  const source = orderId ? "FROM_ORDER" : "INSTANT";

  const customers = useQuery({
    queryKey: lrLookupKeys.customers,
    queryFn: lrLookups.customers,
  });
  const branches = useQuery({
    queryKey: lrLookupKeys.branches,
    queryFn: lrLookups.branches,
  });
  const railheads = useQuery({
    queryKey: lrLookupKeys.railheadBranches,
    queryFn: lrLookups.railheadBranches,
    enabled: source === "FROM_ORDER",
  });
  const marketVehicles = useQuery({
    queryKey: lrLookupKeys.marketVehicles,
    queryFn: lrLookups.marketVehicles,
  });
  const drivers = useQuery({
    queryKey: lrLookupKeys.drivers,
    queryFn: lrLookups.drivers,
  });
  const goodsMaster = useQuery({
    queryKey: lrLookupKeys.goods,
    queryFn: lrLookups.goods,
  });

  // FROM_ORDER: the order's context (parties, route, freight, consignment lines
  // per truck) and the groups already created against it — so we offer only
  // trucks that both have lines and aren't already grouped, and can summarise
  // exactly what will be generated.
  const orderContext = useQuery({
    queryKey: lrLookupKeys.orderContext(orderId ?? ""),
    queryFn: () => lrLookups.orderContext(orderId as string),
    enabled: source === "FROM_ORDER" && Boolean(orderId),
  });
  const orderGroups = useQuery({
    queryKey: ["lr-groups", "by-order", orderId ?? ""] as const,
    queryFn: () => lrGroupApi.list({ filter: { orderId: orderId! } }),
    enabled: source === "FROM_ORDER" && Boolean(orderId),
  });

  const form = useForm<CreateLRGroupFormInput, unknown, CreateLRGroupBody>({
    resolver: zodResolver(createLRGroupSchema, undefined, { raw: true }),
    defaultValues:
      source === "FROM_ORDER"
        ? {
            source: "FROM_ORDER",
            orderId,
            truckIndex: 1,
            transportType: "Road",
            tripLegType: "DIRECT",
            priority: "Normal",
            isMarketVehicle: false,
          }
        : {
            source: "INSTANT",
            priority: "Normal",
            isMarketVehicle: false,
            primaryTripId: tripId,
            lrs: [],
          },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lrs",
  });
  const errors = form.formState.errors;

  const [watchIsMarket, watchTransport, watchConsignor, watchConsignee] =
    useWatch({
      control: form.control,
      name: [
        "isMarketVehicle",
        source === "FROM_ORDER" ? "transportType" : "transportType",
        source === "INSTANT" ? "consignorId" : "orderId",
        source === "INSTANT" ? "consigneeId" : "orderId",
      ],
    });

  const activeConsignorId =
    source === "INSTANT"
      ? ((watchConsignor as string | undefined) ?? undefined)
      : (orderContext.data?.consignorId ?? undefined);

  const trips = useQuery({
    queryKey: lrLookupKeys.attachableTrips(activeConsignorId),
    queryFn: () => lrLookups.attachableTrips(activeConsignorId),
  });

  const watchPrimaryTripId = form.watch("primaryTripId" as never) as unknown as
    | string
    | undefined;

  // Resolved independently of the consignor filter above, so the selected
  // trip's own client stays known even while the filtered list is refetching.
  const allTrips = useQuery({
    queryKey: lrLookupKeys.attachableTrips(undefined),
    queryFn: () => lrLookups.attachableTrips(undefined),
    enabled: source === "INSTANT",
  });
  const selectedTrip = React.useMemo(
    () => (allTrips.data ?? []).find((t) => t.id === watchPrimaryTripId),
    [allTrips.data, watchPrimaryTripId],
  );

  // Picking a trip fixes the consignor to that trip's client (a trip carries
  // one client) — fills it in when it's empty or mismatched, e.g. arriving
  // from the trip's "Start trip" action with only a trip preset.
  React.useEffect(() => {
    if (source !== "INSTANT") return;
    const tripConsignorId = selectedTrip?.consignor?.id;
    if (tripConsignorId && tripConsignorId !== watchConsignor) {
      form.setValue("consignorId" as never, tripConsignorId as never, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [source, selectedTrip, watchConsignor, form]);

  // Clear a previously-picked trip if the consignor changes away from it —
  // but not when the auto-fill above is what changed the consignor.
  const prevConsignorRef = React.useRef(activeConsignorId);
  React.useEffect(() => {
    if (prevConsignorRef.current !== activeConsignorId) {
      prevConsignorRef.current = activeConsignorId;
      if (selectedTrip && selectedTrip.consignor?.id !== activeConsignorId) {
        form.setValue("primaryTripId" as never, undefined as never, {
          shouldValidate: true,
        });
      }
    }
  }, [activeConsignorId, form, selectedTrip]);

  // Instant lines pick loading/unloading from the parties' saved locations.
  const consignorLocations = useQuery({
    queryKey: lrLookupKeys.customerLocations((watchConsignor as string) ?? ""),
    queryFn: () => lrLookups.customerLocations(watchConsignor as string),
    enabled: source === "INSTANT" && Boolean(watchConsignor),
  });
  const consigneeLocations = useQuery({
    queryKey: lrLookupKeys.customerLocations((watchConsignee as string) ?? ""),
    queryFn: () => lrLookups.customerLocations(watchConsignee as string),
    enabled: source === "INSTANT" && Boolean(watchConsignee),
  });

  const customerOptions = customers.data ?? [];
  const branchOptions = (branches.data ?? []).map((b) => ({
    value: b.value,
    label: b.label,
  }));
  const tripOptions = (trips.data ?? []).map((t) => ({
    value: t.id,
    label: t.label,
    hint: t.hint,
    badge: t.badge,
  }));

  const handleTripCreated = async (created: Trip) => {
    await queryClient.invalidateQueries({
      queryKey: ["lookup", "attachable-trips"],
    });
    form.setValue("primaryTripId" as never, created.id as never, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };
  const goodsSuggestions = (goodsMaster.data ?? []).map((g) => ({
    value: g.name,
    hint: g.description ?? undefined,
  }));
  const marketVehicleSuggestions = (marketVehicles.data ?? []).map((v) => ({
    value: v.vehicleNumber,
    hint: "Market vehicle",
  }));
  const driverSuggestions = (drivers.data ?? []).map((d) => ({
    value: d.name,
    hint: d.mobile ?? undefined,
  }));
  const loadingOptions = (consignorLocations.data ?? []).map((l) => ({
    value: l.value,
    label: l.label,
  }));
  const unloadingOptions = (consigneeLocations.data ?? []).map((l) => ({
    value: l.value,
    label: l.label,
  }));
  // Union of both parties' locations — lets the summary resolve INSTANT line
  // loading/unloading ids to names regardless of which party they came from.
  const locationOptions = React.useMemo(() => {
    const seen = new Map<string, { value: string; label: string }>();
    for (const o of [...loadingOptions, ...unloadingOptions]) {
      if (!seen.has(o.value)) seen.set(o.value, o);
    }
    return [...seen.values()];
  }, [loadingOptions, unloadingOptions]);

  // Trucks already claimed by a live (non-cancelled) group can't be reused.
  const takenTrucks = React.useMemo(
    () =>
      new Set(
        (orderGroups.data?.data ?? [])
          .filter((g) => g.status !== "CANCELLED")
          .map((g) => g.truckIndex),
      ),
    [orderGroups.data],
  );
  const truckOptions = React.useMemo(
    () =>
      (orderContext.data?.trucks ?? [])
        .filter((t) => !takenTrucks.has(t.truckIndex))
        .map((t) => ({
          value: String(t.truckIndex),
          label: `Truck #${t.truckIndex} · ${t.lineCount} LR${t.lineCount === 1 ? "" : "s"}`,
        })),
    [orderContext.data, takenTrucks],
  );
  const trucksLoading = orderContext.isLoading || orderGroups.isLoading;

  // Keep truckIndex on a valid, available truck: preselect the first option, and
  // re-point if the current pick got taken or has no lines.
  React.useEffect(() => {
    if (source !== "FROM_ORDER" || trucksLoading || truckOptions.length === 0) {
      return;
    }
    const current = String(form.getValues("truckIndex") ?? "");
    if (!truckOptions.some((o) => o.value === current)) {
      form.setValue("truckIndex", Number(truckOptions[0]!.value) as never, {
        shouldValidate: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, trucksLoading, truckOptions]);

  const showRailhead =
    source === "FROM_ORDER" && (watchTransport as string) === "RoadAndRail";

  const onSubmit = async (values: CreateLRGroupBody) => {
    setSubmitting(true);
    try {
      const group = await lrGroupApi.create(values);
      toast.success(`Group ${group.groupNumber} created`);
      router.push(`/lorry-receipts/${group.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };
  const moneyNumber = (value: unknown) => {
    const n =
      typeof value === "number"
        ? value
        : Number(String(value ?? "").trim() || 0);

    return Number.isFinite(n) ? n : 0;
  };

  const marketFreightAmount = form.watch("marketFreightAmount" as never);
  const marketAdvanceAmount = form.watch("marketAdvanceAmount" as never);
  const marketCommissionAmount = form.watch("marketCommissionAmount" as never);
  const marketHamaliAmount = form.watch("marketHamaliAmount" as never);
  const marketTdsAmount = form.watch("marketTdsAmount" as never);

  const totalFreightAdvance =
    moneyNumber(marketAdvanceAmount) +
    moneyNumber(marketCommissionAmount) +
    moneyNumber(marketHamaliAmount) +
    moneyNumber(marketTdsAmount);

  const netBalanceFreight =
    moneyNumber(marketFreightAmount) - totalFreightAdvance;
  return (
    <FormProvider {...form}>
      <div className="mx-auto grid max-w-6xl gap-6 p-4 md:p-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="order-2 min-w-0 space-y-5 lg:order-1"
        >
          <div className="flex flex-col gap-3 rounded-lg border bg-background p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-lg font-semibold">
                {source === "FROM_ORDER"
                  ? "Create LR Group from Order"
                  : "Create Instant LR Group"}
              </h1>
              {/* <p className="mt-0.5 text-xs text-muted-foreground">
              {source === "FROM_ORDER"
                ? "LRs are generated from the order's consignment lines for the chosen truck."
                : "Standalone Road group — you can add consignment lines now or later."}
            </p> */}
            </div>
            <div className="flex items-end gap-2">
              <Controller
                name="priority"
                control={form.control}
                render={({ field }) => (
                  <div className="min-w-36">
                    <FieldLabel>Priority</FieldLabel>
                    <Select
                      value={(field.value as string) ?? "Normal"}
                      onValueChange={field.onChange as (v: string) => void}
                    >
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue placeholder="Priority" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  router.push(
                    orderId ? `/orders/${orderId}` : "/lorry-receipts",
                  )
                }
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating…" : "Create group"}
              </Button>
            </div>
          </div>

          {source === "FROM_ORDER" && (
            <FormSection
              icon={<IconRoute size={16} />}
              title="Truck & transport"
              columns={2}
            >
              <Controller
                name="truckIndex"
                control={form.control}
                render={({ field }) => (
                  <div>
                    <FieldLabel required>Truck #</FieldLabel>
                    <Select
                      value={
                        field.value != null &&
                        truckOptions.some(
                          (o) => o.value === String(field.value),
                        )
                          ? String(field.value)
                          : undefined
                      }
                      onValueChange={(v) => field.onChange(Number(v))}
                      disabled={trucksLoading || truckOptions.length === 0}
                    >
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue
                          placeholder={
                            trucksLoading ? "Loading trucks…" : "Select truck"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {truckOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!trucksLoading && truckOptions.length === 0 && (
                      <p className="mt-1 text-xs text-amber-600">
                        {(orderContext.data?.trucks?.length ?? 0) === 0
                          ? "This order has no consignment lines — add them on the order first."
                          : "All trucks for this order already have a group."}
                      </p>
                    )}
                  </div>
                )}
              />
              <Controller
                name="transportType"
                control={form.control}
                render={({ field }) => (
                  <div>
                    <FieldLabel>Mode</FieldLabel>
                    <Segmented
                      value={(field.value as string) ?? "Road"}
                      onChange={(v) => {
                        field.onChange(v);
                        if (v !== "RoadAndRail")
                          form.setValue(
                            "railheadBranchId" as never,
                            undefined as never,
                          );
                      }}
                      options={TRANSPORT_OPTIONS}
                    />
                  </div>
                )}
              />
              {showRailhead && (
                <ComboboxField
                  name="railheadBranchId"
                  label="Railhead branch"
                  required
                  options={(railheads.data ?? []).map((b) => ({
                    value: b.value,
                    label: b.label,
                  }))}
                  emptyText="No railhead branches found"
                />
              )}
            </FormSection>
          )}

          {source === "INSTANT" && (
            <FormSection
              icon={<IconUsers size={16} />}
              title="Parties"
              columns={2}
            >
              <ComboboxField
                name="consignorId"
                label="Consignor"
                required
                options={customerOptions}
              />
              <ComboboxField
                name="consigneeId"
                label="Consignee"
                required
                options={customerOptions}
              />
              <ComboboxField
                name="originBranchId"
                label="Origin branch"
                required
                options={branchOptions}
              />
              <ComboboxField
                name="destinationBranchId"
                label="Destination branch"
                required
                options={branchOptions}
              />
            </FormSection>
          )}

          {/* Vehicle */}
          <FormSection
            icon={<IconTruck size={16} />}
            title="Vehicle"
            columns={1}
          >
            <Controller
              name="isMarketVehicle"
              control={form.control}
              render={({ field }) => (
                <div>
                  <FieldLabel>Transport by</FieldLabel>
                  <Segmented
                    value={(field.value as boolean) ?? false}
                    onChange={(v) => {
                      field.onChange(v);

                      if (v) {
                        // Market vehicle selected, own trip not required
                        form.setValue(
                          "primaryTripId" as never,
                          undefined as never,
                        );
                      } else {
                        // Own vehicle selected, clear market vehicle data
                        form.setValue(
                          "marketVehicleNumber" as never,
                          undefined as never,
                        );
                        form.setValue(
                          "marketDriverName" as never,
                          undefined as never,
                        );
                        form.setValue(
                          "marketFreightAmount" as never,
                          undefined as never,
                        );
                        form.setValue(
                          "marketAdvanceAmount" as never,
                          undefined as never,
                        );
                        form.setValue(
                          "marketCommissionAmount" as never,
                          undefined as never,
                        );
                        form.setValue(
                          "marketHamaliAmount" as never,
                          undefined as never,
                        );
                        form.setValue(
                          "marketTdsAmount" as never,
                          undefined as never,
                        );
                      }
                    }}
                    options={[
                      { value: false, label: "Own Vehicle" },
                      { value: true, label: "Market Vehicle" },
                    ]}
                  />
                </div>
              )}
            />

            {!watchIsMarket && (
              <div className="mt-3 max-w-xl">
                <ComboboxField
                  name="primaryTripId"
                  label="Trip"
                  required
                  options={tripOptions}
                  emptyText="No trips available — create a trip first"
                  actionLabel="+ New Trip"
                  onAction={() => setCreateTripOpen(true)}
                />
              </div>
            )}

            {watchIsMarket && (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Controller
                  name="marketVehicleNumber"
                  control={form.control}
                  render={({ field }) => (
                    <div>
                      <FieldLabel required>Vehicle number</FieldLabel>
                      <SuggestInput
                        value={(field.value as string) ?? ""}
                        onChange={(value) =>
                          field.onChange(
                            value.toUpperCase().replace(/\s+/g, ""),
                          )
                        }
                        onBlur={field.onBlur}
                        suggestions={marketVehicleSuggestions}
                        placeholder={
                          marketVehicles.isLoading
                            ? "Loading market vehicles..."
                            : "Select or type vehicle"
                        }
                        invalid={Boolean(errors.marketVehicleNumber?.message)}
                        className="[&_input]:h-9 [&_input]:uppercase"
                      />
                    </div>
                  )}
                />

                <Controller
                  name="marketDriverName"
                  control={form.control}
                  render={({ field }) => (
                    <div>
                      <FieldLabel>Driver</FieldLabel>
                      <SuggestInput
                        value={(field.value as string) ?? ""}
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

                <div>
                  <FieldLabel>Freight amount</FieldLabel>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    className="h-9"
                    {...form.register("marketFreightAmount")}
                  />
                </div>

                <div>
                  <FieldLabel>Advance amount</FieldLabel>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    className="h-9"
                    {...form.register("marketAdvanceAmount")}
                  />
                </div>

                <div>
                  <FieldLabel>Commission</FieldLabel>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    className="h-9"
                    {...form.register("marketCommissionAmount")}
                  />
                </div>

                <div>
                  <FieldLabel>Hamali</FieldLabel>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    className="h-9"
                    {...form.register("marketHamaliAmount")}
                  />
                </div>

                <div>
                  <FieldLabel>TDS</FieldLabel>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    className="h-9"
                    {...form.register("marketTdsAmount")}
                  />
                </div>
                <ReadOnlyAmount
                  label="Total Freight Advance"
                  value={totalFreightAdvance}
                />

                <ReadOnlyAmount
                  label="Net Balance Freight"
                  value={netBalanceFreight}
                  strong
                />
              </div>
            )}
          </FormSection>

          {/* Consignment lines (INSTANT only — FROM_ORDER reads from the order) */}
          {source === "INSTANT" && (
            <FormSection
              icon={<IconPackage size={16} />}
              title="Consignments / LR Lines"
              columns={1}
            >
              <div className="space-y-3">
                {fields.length === 0 && (
                  <div className="rounded-lg border border-dashed bg-muted/20 p-4">
                    <p className="text-sm font-medium">
                      No consignment line added
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      You can create the LR group now and add LR lines later.
                    </p>
                  </div>
                )}
                {fields.map((field, idx) => {
                  const base = `lrs.${idx}` as const;
                  // `lrs` only exists on the INSTANT branch of the union; narrow it.
                  const lrsErrors = (
                    errors as {
                      lrs?: { goods?: { name?: { message?: string } }[] }[];
                    }
                  ).lrs;
                  const lineErr = lrsErrors?.[idx];
                  return (
                    <div
                      key={field.id}
                      className="relative rounded-lg border bg-muted/20 p-3"
                    >
                      {fields.length > 0 && (
                        <button
                          type="button"
                          onClick={() => remove(idx)}
                          className="absolute right-2 top-2 rounded-sm p-1 text-muted-foreground hover:text-red-600"
                          aria-label="Remove consignment line"
                        >
                          <IconTrash size={14} />
                        </button>
                      )}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <ComboboxField
                          name={`${base}.loadingLocationId`}
                          label="Loading point"
                          options={loadingOptions}
                          emptyText={
                            watchConsignor
                              ? "No saved locations"
                              : "Pick a consignor first"
                          }
                        />
                        <ComboboxField
                          name={`${base}.unloadingLocationId`}
                          label="Unloading point"
                          options={unloadingOptions}
                          emptyText={
                            watchConsignee
                              ? "No saved locations"
                              : "Pick a consignee first"
                          }
                        />
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-4">
                        <div className="sm:col-span-2">
                          <FieldLabel required>Goods name</FieldLabel>
                          <Controller
                            name={`${base}.goods.0.name`}
                            control={form.control}
                            render={({ field }) => (
                              <SuggestInput
                                value={(field.value as string) ?? ""}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                suggestions={goodsSuggestions}
                                placeholder="Select or type goods"
                                invalid={Boolean(
                                  lineErr?.goods?.[0]?.name?.message,
                                )}
                              />
                            )}
                          />
                        </div>
                        <div>
                          <FieldLabel required>Qty</FieldLabel>
                          <Input
                            {...form.register(`${base}.goods.0.quantity`)}
                            type="number"
                            min={1}
                            className="h-9"
                          />
                        </div>
                        <div>
                          <FieldLabel required>Unit</FieldLabel>
                          <Input
                            {...form.register(`${base}.goods.0.unit`)}
                            placeholder="MT / PCS"
                            className="h-9"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append(EMPTY_LINE)}
                >
                  <IconPlus size={14} className="mr-1" /> Add consignment line
                </Button>
              </div>
            </FormSection>
          )}
        </form>

        <div className="order-1 lg:order-2">
          <LRCreateSummary
            source={source}
            order={orderContext.data}
            orderLoading={source === "FROM_ORDER" && orderContext.isLoading}
            customerOptions={customerOptions}
            branchOptions={branchOptions}
            tripOptions={tripOptions}
            locationOptions={locationOptions}
          />
        </div>
      </div>

      <CreateTripDialog
        open={createTripOpen}
        onOpenChange={setCreateTripOpen}
        defaultConsignorId={activeConsignorId}
        onCreated={handleTripCreated}
      />
    </FormProvider>
  );
}
