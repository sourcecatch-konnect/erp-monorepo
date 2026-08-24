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
import {
  SuggestInput,
  type SuggestOption,
} from "@skerp/ui/components/suggest-input";

import FormSection from "@/features/masters/_shared/fields/FormSection";
import ComboboxField from "@/features/masters/_shared/fields/ComboboxField";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";
import { useUnitOfMeasureOptions } from "@/features/masters/unitOfMeasure/useUnitOfMeasureOptions";

import { lrGroupApi } from "../lr-group.service";
import { lrLookups, lrLookupKeys } from "../lorry-receipt.service";
import LRCreateSummary from "./LRCreateSummary";
import { FieldLabel, MoneyField } from "./moneyField";
import CreateTripDialog from "@/features/trips/CreateTripDialog";
import { branchApi } from "@/features/masters/branch/branch.service";

type Props = {
  orderId?: string;
  /** Instant group launched from a Planned trip — preselects that trip. */
  tripId?: string;
};

const EMPTY_LINE = {
  loadingLocationId: undefined as string | undefined,
  unloadingLocationId: undefined as string | undefined,
  totalWeight: undefined as unknown as number,
  totalWeightUnit: "MT",
  goods: [],
};
type DriverLookup = {
  name: string;
  mobile?: string | null;
  isAssigned?: boolean;
  activeGroupNumber?: string | null;
};
const EMPTY_GOODS = {
  name: "",
  description: "",
  quantity: "" as unknown as number,
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
          className={`text-sm ${strong
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
          className={`rounded-[5px] px-3 py-1 text-xs font-medium transition-colors ${value === o.value
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

type LRFormApi = ReturnType<
  typeof useForm<CreateLRGroupFormInput, unknown, CreateLRGroupBody>
>;

function InstantLRLineCard({
  form,
  idx,
  totalLines,
  loadingOptions,
  unloadingOptions,
  unitOptions,
  goodsSuggestions,
  watchConsignor,
  watchConsignee,
  onRemove,
}: {
  form: LRFormApi;
  idx: number;
  totalLines: number;
  loadingOptions: { value: string; label: string }[];
  unloadingOptions: { value: string; label: string }[];
  unitOptions: { value: string; label: string }[];
  goodsSuggestions: { value: string; hint?: string }[];
  watchConsignor: unknown;
  watchConsignee: unknown;
  onRemove: () => void;
}) {
  const base = `lrs.${idx}` as const;
  const {
    fields: goodsFields,
    append: appendGoods,
    remove: removeGoods,
  } = useFieldArray({
    control: form.control,
    name: `${base}.goods`,
  });
  const lineErr = (
    form.formState.errors as {
      lrs?: {
        loadingLocationId?: { message?: string };
        unloadingLocationId?: { message?: string };
        totalWeight?: { message?: string };
        totalWeightUnit?: { message?: string };
        goods?: {
          name?: { message?: string };
          quantity?: { message?: string };
        }[];
      }[];
    }
  ).lrs?.[idx];

  return (
    <div className="relative rounded-lg border bg-muted/20 p-3">
      <button
        type="button"
        onClick={onRemove}
        disabled={totalLines <= 1}
        className="absolute right-2 top-2 rounded-sm p-1 text-muted-foreground hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Remove consignment line"
      >
        <IconTrash size={14} />
      </button>
      <div className="grid gap-3 sm:grid-cols-2">
        <ComboboxField
          name={`${base}.loadingLocationId`}
          label="Loading point"
          required
          options={loadingOptions}
          emptyText={
            watchConsignor ? "No saved locations" : "Pick a consignor first"
          }
        />
        <ComboboxField
          name={`${base}.unloadingLocationId`}
          label="Unloading point"

          options={unloadingOptions}
          emptyText={
            watchConsignee ? "No saved locations" : "Pick a consignee first"
          }
        />
      </div>

      {lineErr?.loadingLocationId?.message ? (
        <p className="mt-1 text-xs text-red-600">
          {lineErr.loadingLocationId.message}
        </p>
      ) : null}
      {lineErr?.unloadingLocationId?.message ? (
        <p className="mt-1 text-xs text-red-600">
          {lineErr.unloadingLocationId.message}
        </p>
      ) : null}

      <div className="mt-3 rounded-md bg-background/70 p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Goods <span className="font-normal normal-case">(Optional)</span>
          </p>
        </div>

        {goodsFields.length === 0 ? (
          <div className="rounded-md border border-dashed bg-muted/20 px-3 py-3 text-center text-xs text-muted-foreground">
            No goods added yet.
          </div>
        ) : (
          <div className="space-y-2">
            {goodsFields.map((goodsField, goodsIdx) => {
              const goodsBase = `${base}.goods.${goodsIdx}` as const;
              const goodsErr = lineErr?.goods?.[goodsIdx];

              return (
                <div key={goodsField.id} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <FieldLabel>Goods name</FieldLabel>
                    <Controller
                      name={`${goodsBase}.name`}
                      control={form.control}
                      render={({ field }) => (
                        <SuggestInput
                          value={(field.value as string) ?? ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          suggestions={goodsSuggestions}
                          placeholder="Select or type goods"
                          invalid={Boolean(goodsErr?.name?.message)}
                        />
                      )}
                    />

                    {goodsErr?.name?.message ? (
                      <p className="mt-1 text-xs text-red-600">
                        {goodsErr.name.message}
                      </p>
                    ) : null}
                  </div>

                  <div className="w-24 shrink-0">
                    <FieldLabel>Qty</FieldLabel>
                    <Input
                      {...form.register(`${goodsBase}.quantity`)}
                      type="number"
                      min={1}
                      className="h-9"
                      aria-invalid={Boolean(goodsErr?.quantity?.message)}
                    />

                    {goodsErr?.quantity?.message ? (
                      <p className="mt-1 text-xs text-red-600">
                        {goodsErr.quantity.message}
                      </p>
                    ) : null}
                  </div>

                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="mt-6 shrink-0 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                    onClick={() => removeGoods(goodsIdx)}
                    aria-label="Remove goods"
                  >
                    <IconTrash size={14} />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => appendGoods(EMPTY_GOODS)}
        >
          <IconPlus size={14} className="mr-1" /> Add goods
        </Button>
      </div>
      <div className="mt-3 grid gap-1.5">
        <div className="flex items-center justify-start gap-3">
          <label className="w-28 shrink-0 text-xs font-medium text-muted-foreground">
            Total weight
          </label>

          <div className="w-40 shrink-0">
            <Input
              {...form.register(`${base}.totalWeight`)}
              type="number"
              min={0}
              step="0.01"
              placeholder="Weight"
              className="h-9"
              aria-invalid={Boolean(lineErr?.totalWeight)}
            />
          </div>

          <div className="w-28 shrink-0">
            <Controller
              name={`${base}.totalWeightUnit`}
              control={form.control}
              render={({ field }) => (
                <Select
                  value={(field.value as string) ?? "MT"}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {unitOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        {lineErr?.totalWeight?.message ? (
          <p className="ml-28 text-xs text-red-600">
            {lineErr.totalWeight.message}
          </p>
        ) : null}

        {lineErr?.totalWeightUnit?.message ? (
          <p className="ml-28 text-xs text-red-600">
            {lineErr.totalWeightUnit.message}
          </p>
        ) : null}
      </div>
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
  const transports = useQuery({
    queryKey: lrLookupKeys.transports,
    queryFn: lrLookups.transports,
  });
  const drivers = useQuery({
    queryKey: lrLookupKeys.drivers,
    queryFn: lrLookups.drivers,
  });
  const goodsMaster = useQuery({
    queryKey: lrLookupKeys.goods,
    queryFn: lrLookups.goods,
  });
  const units = useUnitOfMeasureOptions();

  // FROM_ORDER: the order's context (parties, route, freight, truck count)
  // and the groups already created against it — so we offer only trucks that
  // aren't already grouped. Consignments themselves (loading/unloading,
  // goods) are entered right here in the form, not read from the order.
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
          lrs: [EMPTY_LINE],
        }
        : {
          source: "INSTANT",
          priority: "Normal",
          isMarketVehicle: false,
          primaryTripId: tripId,
          lrs: [EMPTY_LINE],
        },
  });

  const watchedRailheadBranchId = form.watch(
    "railheadBranchId" as never,
  ) as unknown as string | undefined;
  const sourceRailheadAreas = useQuery({
    queryKey: ["lr-source-railheads", watchedRailheadBranchId ?? ""],
    queryFn: () => branchApi.railheads(watchedRailheadBranchId as string),
    enabled: source === "FROM_ORDER" && Boolean(watchedRailheadBranchId),
  });
  const previousRailheadBranchRef = React.useRef(watchedRailheadBranchId);
  React.useEffect(() => {
    if (previousRailheadBranchRef.current === watchedRailheadBranchId) return;
    previousRailheadBranchRef.current = watchedRailheadBranchId;
    form.setValue("sourceRailheadAreaId" as never, undefined as never, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [form, watchedRailheadBranchId]);
  const destinationRailheadBranchId = orderContext.data?.toBranch?.id;
  const destinationRailheadAreas = useQuery({
    queryKey: ["lr-destination-railheads", destinationRailheadBranchId ?? ""],
    queryFn: () => branchApi.railheads(destinationRailheadBranchId as string),
    enabled: source === "FROM_ORDER" && Boolean(destinationRailheadBranchId),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lrs",
  });
  const errors = form.formState.errors;

  const [
    watchIsMarket,
    watchTransport,
    watchConsignor,
    watchConsignee,
    watchMarketTransportId,
  ] = useWatch({
    control: form.control,
    name: [
      "isMarketVehicle",
      source === "FROM_ORDER" ? "transportType" : "transportType",
      source === "INSTANT" ? "consignorId" : "orderId",
      source === "INSTANT" ? "consigneeId" : "orderId",
      "marketTransportId",
    ],
  });
  const marketTransportId =
    (watchMarketTransportId as string | undefined) ?? "";
  const marketVehicles = useQuery({
    queryKey: lrLookupKeys.marketVehicles(marketTransportId),
    queryFn: () => lrLookups.marketVehicles(marketTransportId),
    enabled: Boolean(watchIsMarket && marketTransportId),
  });
  const activeConsignorId =
    source === "INSTANT"
      ? ((watchConsignor as string | undefined) ?? undefined)
      : (orderContext.data?.consignorId ?? undefined);
  const activeConsigneeId =
    source === "INSTANT"
      ? ((watchConsignee as string | undefined) ?? undefined)
      : (orderContext.data?.consigneeId ?? undefined);

  const trips = useQuery({
    queryKey: lrLookupKeys.attachableTrips(activeConsignorId),
    queryFn: () => lrLookups.attachableTrips(activeConsignorId),
  });
  const watchPrimaryTripId = form.watch("primaryTripId" as never) as unknown as
    | string
    | undefined;
  const allTrips = useQuery({
    queryKey: lrLookupKeys.attachableTrips(undefined),
    queryFn: () => lrLookups.attachableTrips(undefined),
    enabled: source === "INSTANT",
  });
  const selectedTrip = React.useMemo(
    () => (allTrips.data ?? []).find((t) => t.id === watchPrimaryTripId),
    [allTrips.data, watchPrimaryTripId],
  );

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

  // Consignment lines (both sources now) pick loading/unloading from the
  // parties' saved locations — INSTANT's user-picked consignor/consignee,
  // or FROM_ORDER's fixed ones from the order itself.
  const consignorLocations = useQuery({
    queryKey: lrLookupKeys.customerLocations(activeConsignorId ?? ""),
    queryFn: () => lrLookups.customerLocations(activeConsignorId as string),
    enabled: Boolean(activeConsignorId),
  });
  const consigneeLocations = useQuery({
    queryKey: lrLookupKeys.customerLocations(activeConsigneeId ?? ""),
    queryFn: () => lrLookups.customerLocations(activeConsigneeId as string),
    enabled: Boolean(activeConsigneeId),
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
  const goodsSuggestions = (goodsMaster.data ?? []).map((g) => ({
    value: g.name,
    hint: g.description ?? undefined,
  }));
  const driverRows = (drivers.data ?? []) as DriverLookup[];

  const driverSuggestions: SuggestOption[] = driverRows.map((d) => ({
    value: d.name,
    hint: d.isAssigned
      ? d.activeGroupNumber
        ? `${d.mobile ?? "No mobile"}`
        : `${d.mobile ?? "No mobile"}`
      : (d.mobile ?? undefined),
    badge: d.isAssigned ? "Assigned" : "Available",
    badgeTone: d.isAssigned ? "warning" : "success",
  }));
  const marketVehicleSuggestions: SuggestOption[] = (
    marketVehicles.data ?? []
  ).map((vehicle) => ({
    value: vehicle.vehicleNumber,
    hint: vehicle.vehicleTypeRef.name,
    badge: "Registered",
    badgeTone: "muted",
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
  // Every truck 1..truckQuantity is offered, minus whichever already have a
  // live group — no longer limited to trucks that happen to already have
  // consignment lines, since those are entered in this form now, not before.
  const truckOptions = React.useMemo(() => {
    const truckQuantity = orderContext.data?.truckQuantity ?? 0;
    return Array.from({ length: truckQuantity }, (_, i) => i + 1)
      .filter((truckIndex) => !takenTrucks.has(truckIndex))
      .map((truckIndex) => ({
        value: String(truckIndex),
        label: `Truck #${truckIndex}`,
      }));
  }, [orderContext.data, takenTrucks]);
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

  // How many LRs this submit will create — drives LR-first button/toast copy.
  // Same source for both: the live consignment-line editor's current rows.
  const plannedLrCount = fields.length;

  const onSubmit = async (values: CreateLRGroupBody) => {
    setSubmitting(true);
    try {
      const group = await lrGroupApi.create(values);
      const createdLrs = group.lorryReceipts ?? [];
      toast.success(
        createdLrs.length === 1
          ? `LR ${createdLrs[0]!.lrNumber} created`
          : `Group ${group.groupNumber} created — ${createdLrs.length} LRs`,
      );
      router.push(`/lorry-receipts/${group.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };
  const handleTripCreated = async (created: Trip) => {
    await queryClient.invalidateQueries({
      queryKey: lrLookupKeys.attachableTrips(activeConsignorId),
    });
    await queryClient.invalidateQueries({
      queryKey: lrLookupKeys.attachableTrips(undefined),
    });
    form.setValue("primaryTripId" as never, created.id as never, {
      shouldDirty: true,
      shouldValidate: true,
    });
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
                  ? "Create LR from Order"
                  : "Create Instant LR"}
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {source === "FROM_ORDER"
                  ? plannedLrCount > 1
                    ? `This truck will create ${plannedLrCount} LRs travelling together.`
                    : "The LR is generated from the order's consignment line for the chosen truck."
                  : "Standalone Road LR — add at least one loading and unloading point."}
              </p>
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
                {submitting
                  ? "Creating…"
                  : plannedLrCount > 1
                    ? `Create ${plannedLrCount} LRs`
                    : "Create LR"}
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
                        {(orderContext.data?.truckQuantity ?? 0) === 0
                          ? "This order has no truck quantity set."
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
                        if (v !== "RoadAndRail") {
                          form.setValue(
                            "sourceRailheadAreaId" as never,
                            undefined as never,
                          );
                          form.setValue(
                            "destinationRailheadAreaId" as never,
                            undefined as never,
                          );
                        }
                      }}
                      options={TRANSPORT_OPTIONS}
                    />
                  </div>
                )}
              />
              {showRailhead && (
                <>
                  <ComboboxField
                    name="railheadBranchId"
                    label="Source railway branch"
                    required
                    options={(railheads.data ?? []).map((b) => ({
                      value: b.value,
                      label: b.label,
                    }))}
                    emptyText="No railhead branches found"
                  />
                  <ComboboxField
                    name="sourceRailheadAreaId"
                    label="Source railhead"
                    required
                    options={(sourceRailheadAreas.data ?? []).map((item) => ({
                      value: item.area.id,
                      label: `${item.area.name} (${item.area.city.name})`,
                    }))}
                    emptyText="No railheads mapped to this branch"
                  />
                  <ComboboxField
                    name="destinationRailheadAreaId"
                    label="Destination railhead"
                    required
                    options={(destinationRailheadAreas.data ?? []).map(
                      (item) => ({
                        value: item.area.id,
                        label: `${item.area.name} (${item.area.city.name})`,
                      }),
                    )}
                    emptyText="No railheads mapped to the destination branch"
                  />
                </>
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
          {/* Consignment lines — both sources declare them here now. FROM_ORDER
              no longer reads these from the order; the order only fixes the
              truck count, each truck's own loading/unloading/goods is
              entered when that truck's LR actually gets created. */}
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
                    Add at least one consignment line with loading and
                    unloading points.
                  </p>
                </div>
              )}
              {fields.map((field, idx) => {
                return (
                  <InstantLRLineCard
                    key={field.id}
                    form={form}
                    idx={idx}
                    totalLines={fields.length}
                    loadingOptions={loadingOptions}
                    unloadingOptions={unloadingOptions}
                    unitOptions={units.options}
                    goodsSuggestions={goodsSuggestions}
                    watchConsignor={activeConsignorId}
                    watchConsignee={activeConsigneeId}
                    onRemove={() => remove(idx)}
                  />
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
                          "marketTransportId" as never,
                          undefined as never,
                        );
                        form.setValue(
                          "marketVehicleId" as never,
                          undefined as never,
                        );
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
                  name="marketTransportId"
                  control={form.control}
                  render={({ field }) => (
                    <div>
                      <FieldLabel required>Transporter</FieldLabel>
                      <Select
                        value={(field.value as string) ?? ""}
                        onValueChange={(value) => {
                          field.onChange(value);
                          form.setValue(
                            "marketVehicleId" as never,
                            undefined as never,
                            { shouldValidate: true },
                          );
                          form.setValue(
                            "marketVehicleNumber" as never,
                            undefined as never,
                          );
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
                          {(transports.data ?? []).map((transport) => (
                            <SelectItem key={transport.id} value={transport.id}>
                              {transport.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                        value={(field.value as string) ?? ""}
                        onChange={(value) => {
                          field.onChange(value);
                          const vehicle = (marketVehicles.data ?? []).find(
                            (row) =>
                              row.vehicleNumber.trim().toLowerCase() ===
                              value.trim().toLowerCase(),
                          );
                          form.setValue(
                            "marketVehicleId" as never,
                            vehicle?.id as never,
                            { shouldValidate: true },
                          );
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

                <MoneyField<CreateLRGroupFormInput>
                  name="marketFreightAmount"
                  label="Freight amount"
                />

                <MoneyField<CreateLRGroupFormInput>
                  name="marketAdvanceAmount"
                  label="Advance amount"
                />

                <MoneyField<CreateLRGroupFormInput>
                  name="marketCommissionAmount"
                  label="Commission"
                />

                <MoneyField<CreateLRGroupFormInput>
                  name="marketHamaliAmount"
                  label="Hamali"
                />

                <MoneyField<CreateLRGroupFormInput>
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
                  strong
                />
              </div>
            )}
          </FormSection>


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
