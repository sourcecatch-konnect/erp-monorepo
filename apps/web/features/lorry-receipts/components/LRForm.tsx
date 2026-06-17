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
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  IconPlus,
  IconTrash,
  IconTruck,
  IconUsers,
  IconPackage,
  IconArrowNarrowRight,
  IconRoute,
  IconCalendar,
  IconCoin,
  IconInfoCircle,
} from "@tabler/icons-react";

import { createLRSchema } from "@skerp/validators/lorry-receipt";
import type { CreateLRFormInput, CreateLRBody } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
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
import { SuggestInput } from "@skerp/ui/components/suggest-input";

import FormSection from "@/features/masters/_shared/fields/FormSection";
import ComboboxField from "@/features/masters/_shared/fields/ComboboxField";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";
import { formatDate, formatMoney } from "@/lib/format";

import {
  lorryReceiptApi,
  lrLookups,
  lrLookupKeys,
} from "../lorry-receipt.service";

type Props = {
  orderId?: string;
  /** Instant LR launched from a Planned trip — preselects that trip. */
  tripId?: string;
};

type GoodsFields = {
  name: string;
  description?: string;
  quantity: number | string;
  unit: string;
  weight?: number | string;
};

const EMPTY_GOODS: GoodsFields = {
  name: "",
  description: "",
  quantity: "",
  unit: "",
  weight: "",
};

// FROM_ORDER: rail-only is never possible — only Road or Road & Rail.
const TRANSPORT_OPTIONS = [
  { value: "Road", label: "Road" },
  { value: "RoadAndRail", label: "Road & Rail" },
] as const;

const PRIORITY_OPTIONS = [
  { value: "Normal", label: "Normal" },
  { value: "Express", label: "Express" },
  { value: "Critical", label: "Critical" },
] as const;

const tripLegLabel = (value?: string) => {
  if (value === "FROM_HUB") return "Trip departure from hub";
  if (value === "TO_HUB") return "To hub";
  return "Direct";
};

const errMsg = (errors: unknown, key: string): string | undefined =>
  (errors as Record<string, { message?: string }>)?.[key]?.message;

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

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

/** Compact inline segmented control. */
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

/* ------------------------------------------------------------------ */
/* Route banner — consignor → vehicle → consignee                      */
/* ------------------------------------------------------------------ */

function RouteBanner({
  consignorName,
  consigneeName,
  fromLabel,
  toLabel,
  vehicleLabel,
  isMarket,
}: {
  consignorName?: string;
  consigneeName?: string;
  fromLabel?: string;
  toLabel?: string;
  vehicleLabel?: string;
  isMarket?: boolean;
}) {
  if (!consignorName && !consigneeName) return null;
  return (
    <div className="flex items-stretch gap-3 rounded-lg border bg-card p-3">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Consignor
        </p>
        <p className="truncate text-sm font-semibold">{consignorName || "—"}</p>
        {fromLabel && (
          <p className="truncate text-[11px] text-muted-foreground">
            {fromLabel}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-center justify-center gap-1 px-1">
        <span
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            vehicleLabel
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <IconTruck size={11} />
          {vehicleLabel
            ? `${isMarket ? "Market · " : ""}${vehicleLabel}`
            : "No vehicle"}
        </span>
        <IconArrowNarrowRight size={18} className="text-muted-foreground/60" />
      </div>

      <div className="min-w-0 flex-1 text-right">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Consignee
        </p>
        <p className="truncate text-sm font-semibold">{consigneeName || "—"}</p>
        {toLabel && (
          <p className="truncate text-[11px] text-muted-foreground">
            {toLabel}
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Order summary panel (right col) — shows order info captured earlier */
/* ------------------------------------------------------------------ */

type OrderSummary = {
  orderNumber: string;
  customerName?: string | null;
  route?: string | null;
  pickupDate?: string | null;
  truckQuantity?: number | null;
  bookingFreightAmount?: number | null;
};

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-sm font-medium">{value ?? "—"}</p>
      </div>
    </div>
  );
}

function ContextPanel({
  source,
  order,
  tripLegLabel,
  selectedTripName,
}: {
  source: string;
  order?: OrderSummary | null;
  tripLegLabel?: string;
  selectedTripName?: string;
}) {
  return (
    <div className="sticky top-4 space-y-4">
      {source === "FROM_ORDER" && order && (
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between border-b pb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Order details
            </p>
            <span className="rounded-sm bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {order.orderNumber}
            </span>
          </div>
          <div className="space-y-3">
            <SummaryRow
              icon={<IconUsers size={13} />}
              label="Customer"
              value={order.customerName}
            />
            <SummaryRow
              icon={<IconRoute size={13} />}
              label="Route"
              value={order.route}
            />
            <SummaryRow
              icon={<IconCalendar size={13} />}
              label="Pickup date"
              value={order.pickupDate ? formatDate(order.pickupDate) : "—"}
            />
            <SummaryRow
              icon={<IconTruck size={13} />}
              label="Trucks ordered"
              value={order.truckQuantity ?? "—"}
            />
            {order.bookingFreightAmount != null && (
              <SummaryRow
                icon={<IconCoin size={13} />}
                label="Booking freight"
                value={formatMoney(order.bookingFreightAmount)}
              />
            )}
          </div>
        </div>
      )}

      {source === "INSTANT" && (
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 border-b pb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Trip summary
            </p>
          </div>
          <div className="space-y-3">
            <SummaryRow
              icon={<IconRoute size={13} />}
              label="Trip type"
              value={tripLegLabel ?? "Direct"}
            />
            <SummaryRow
              icon={<IconTruck size={13} />}
              label="Selected trip"
              value={selectedTripName ?? "Not selected"}
            />
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <IconInfoCircle size={14} className="mt-0.5 shrink-0" />
          <p>
            {source === "INSTANT"
              ? "Instant LR is Road transport only. Saved as DRAFT — finalise after loading to add seal, invoice and freight."
              : "Saved as DRAFT. Seal number, consignor invoice and freight are captured at finalisation."}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main form                                                           */
/* ------------------------------------------------------------------ */

export default function LRForm({ orderId, tripId }: Props) {
  const router = useRouter();
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const source = orderId ? "FROM_ORDER" : "INSTANT";

  const marketVehicles = useQuery({
    queryKey: lrLookupKeys.marketVehicles,
    queryFn: lrLookups.marketVehicles,
  });
  const drivers = useQuery({
    queryKey: lrLookupKeys.drivers,
    queryFn: lrLookups.drivers,
  });
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
  const trips = useQuery({
    queryKey: lrLookupKeys.attachableTrips,
    queryFn: lrLookups.attachableTrips,
  });
  const goodsMaster = useQuery({
    queryKey: lrLookupKeys.goods,
    queryFn: lrLookups.goods,
  });
  const orders = useQuery({
    queryKey: lrLookupKeys.confirmedTruckOrders,
    queryFn: lrLookups.confirmedTruckOrders,
    enabled: source === "FROM_ORDER",
  });

  const form = useForm<CreateLRFormInput, unknown, CreateLRBody>({
    resolver: zodResolver(createLRSchema),
    defaultValues:
      source === "FROM_ORDER"
        ? {
            source: "FROM_ORDER",
            orderId,
            transportType: "Road",
            tripLegType: "DIRECT",
            priority: "Normal",
            isMarketVehicle: false,
            goods: [EMPTY_GOODS],
          }
        : {
            source: "INSTANT",
            priority: "Normal",
            isMarketVehicle: false,
            primaryTripId: tripId,
            goods: [EMPTY_GOODS],
          },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "goods",
  });
  const errors = form.formState.errors;

  const [
    watchConsigneeId,
    watchConsignorId,
    watchOriginBranchId,
    watchDestBranchId,
    watchTransportType,
    watchTripLegType,
    watchIsMarket,
    watchPrimaryTripId,
    watchMarketVehicleNumber,
  ] = useWatch({
    control: form.control,
    name: [
      "consigneeId",
      source === "INSTANT" ? "consignorId" : "orderId",
      source === "INSTANT" ? "originBranchId" : "orderId",
      source === "INSTANT" ? "destinationBranchId" : "orderId",
      source === "FROM_ORDER" ? "transportType" : "orderId",
      source === "FROM_ORDER" ? "tripLegType" : "orderId",
      "isMarketVehicle",
      "primaryTripId",
      "marketVehicleNumber",
    ],
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
  // Market vehicle number is stored as the plate string, so value === label.
  const marketVehicleOptions = (marketVehicles.data ?? []).map((v) => ({
    value: v.vehicleNumber,
    label: v.vehicleNumber,
  }));
  // Driver name is stored as the name string.
  const driverOptions = (drivers.data ?? []).map((d) => ({
    value: d.name,
    label: d.name,
    hint: d.mobile ?? undefined,
  }));

  const orderRow =
    source === "FROM_ORDER"
      ? orders.data?.find((o) => o.id === orderId)
      : undefined;

  // Route banner labels
  const consigneeName = customerOptions.find(
    (c) => c.value === watchConsigneeId,
  )?.label;
  const consignorName =
    source === "INSTANT"
      ? customerOptions.find((c) => c.value === watchConsignorId)?.label
      : orderRow?.customer?.name;
  const fromLabel =
    source === "INSTANT"
      ? (branches.data ?? []).find((b) => b.value === watchOriginBranchId)
          ?.label
      : orderRow?.fromBranch?.shortCode;
  const toLabel =
    source === "INSTANT"
      ? (branches.data ?? []).find((b) => b.value === watchDestBranchId)?.label
      : orderRow?.toBranch?.shortCode;

  const selectedTrip = (trips.data ?? []).find(
    (t) => t.id === watchPrimaryTripId,
  );

  const headOfficeBranch = (branches.data ?? []).find((b) => b.isHeadOffice);
  const hubName = headOfficeBranch?.label ?? "HO branch";
  const tripLegOptions = React.useMemo(
    () => [
      { value: "DIRECT", label: "None" },
      { value: "FROM_HUB", label: `Trip departure from ${hubName}` },
      { value: "TO_HUB", label: `To ${hubName}` },
    ],
    [hubName],
  );
  const vehicleLabel = watchIsMarket
    ? (watchMarketVehicleNumber as string | undefined) || undefined
    : selectedTrip?.vehicle?.vehicleNumber;

  const showRailhead =
    source === "FROM_ORDER" && (watchTransportType as string) === "RoadAndRail";

  const goodsSuggestions = (goodsMaster.data ?? []).map((g) => ({
    value: g.name,
    hint: g.description ?? undefined,
  }));

  // When the typed goods name matches a master goods entry, prefill its
  // description and weight — but never overwrite what the user already typed.
  const prefillGoodsFromMaster = (idx: number, name: string) => {
    const match = (goodsMaster.data ?? []).find(
      (g) => g.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );
    if (!match) return;
    const base = `goods.${idx}` as const;
    const description = form.getValues(
      `${base}.description` as never,
    ) as unknown;
    if (!description && match.description) {
      form.setValue(`${base}.description` as never, match.description as never);
    }
    const weight = form.getValues(`${base}.weight` as never) as unknown;
    if ((weight === "" || weight == null) && match.weight != null) {
      form.setValue(`${base}.weight` as never, match.weight as never);
    }
  };

  const orderSummary: OrderSummary | null = orderRow
    ? {
        orderNumber: orderRow.orderNumber,
        customerName: orderRow.customer?.name,
        route:
          orderRow.fromBranch && orderRow.toBranch
            ? `${orderRow.fromBranch.shortCode} → ${orderRow.toBranch.shortCode}`
            : null,
        pickupDate: orderRow.pickupDate,
        truckQuantity: orderRow.truckQuantity,
        bookingFreightAmount: orderRow.bookingFreightAmount,
      }
    : null;

  const onSubmit = async (values: CreateLRBody) => {
    setSubmitting(true);
    try {
      const lr = await lorryReceiptApi.create(values);
      toast.success(`LR ${lr.lrNumber} created`);
      router.push(`/lorry-receipts/${lr.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (form.formState.isDirty) setDiscardOpen(true);
    else router.push(orderId ? `/orders/${orderId}` : "/lorry-receipts");
  };

  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="mx-auto max-w-6xl space-y-5 p-4 md:p-6"
      >
        {/* Header */}
        <div className="rounded-lg border bg-background p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-lg font-semibold">
                {source === "FROM_ORDER"
                  ? "Create LR from Order"
                  : "Create Instant LR"}
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {source === "FROM_ORDER"
                  ? "Linked to a confirmed truck order. Consignor & route come from the order."
                  : "Standalone Road LR — no parent order."}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
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
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating…" : "Create LR"}
              </Button>
            </div>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
          {/* LEFT — form fields */}
          <div className="space-y-4">
            <RouteBanner
              consignorName={consignorName ?? undefined}
              consigneeName={consigneeName}
              fromLabel={fromLabel ?? undefined}
              toLabel={toLabel ?? undefined}
              vehicleLabel={vehicleLabel}
              isMarket={watchIsMarket as boolean}
            />

            {/* Parties */}
            <FormSection
              icon={<IconUsers size={16} />}
              title="Parties"
              columns={2}
            >
              {source === "INSTANT" && (
                <>
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
                </>
              )}
              {source === "FROM_ORDER" && (
                <div className="col-span-2">
                  <ComboboxField
                    name="consigneeId"
                    label="Consignee"
                    required
                    options={customerOptions}
                  />
                </div>
              )}
            </FormSection>

            {source === "FROM_ORDER" && (
              <FormSection
                icon={<IconRoute size={16} />}
                title="Transport"
                columns={1}
              >
                {/* Mode + Railhead share a row; both are compact controls. */}
                <div className="grid gap-3 sm:grid-cols-2">
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
                        <FieldError message={errMsg(errors, "transportType")} />
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
                </div>

                {/* Trip movement is a wide 3-option control — give it its own row. */}
                <Controller
                  name="tripLegType"
                  control={form.control}
                  render={({ field }) => (
                    <div>
                      <FieldLabel>Trip movement</FieldLabel>
                      <Segmented
                        value={(field.value as string) ?? "DIRECT"}
                        onChange={field.onChange as (v: string) => void}
                        options={tripLegOptions}
                      />
                      <FieldError message={errMsg(errors, "tripLegType")} />
                    </div>
                  )}
                />
              </FormSection>
            )}

            {/* Vehicle assignment */}
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
                      onChange={field.onChange as (v: boolean) => void}
                      options={[
                        { value: false, label: "Own Vehicle" },
                        { value: true, label: "Market Vehicle" },
                      ]}
                    />
                  </div>
                )}
              />

              {!watchIsMarket && (
                <div className="mt-3 max-w-2xl">
                  <ComboboxField
                    name="primaryTripId"
                    label="Trip"
                    required
                    options={tripOptions}
                    emptyText="No trips available — create a trip first"
                  />
                </div>
              )}

              {watchIsMarket && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Controller
                    name="marketVehicleNumber"
                    control={form.control}
                    render={({ field }) => (
                      <div>
                        <FieldLabel required>Vehicle number</FieldLabel>
                        <SuggestInput
                          value={(field.value as string) ?? ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          suggestions={marketVehicleOptions.map((v) => ({
                            value: v.value,
                          }))}
                          placeholder="Search or type — e.g. MH12AB1234"
                          invalid={Boolean(
                            errMsg(errors, "marketVehicleNumber"),
                          )}
                        />
                        <FieldError
                          message={errMsg(errors, "marketVehicleNumber")}
                        />
                      </div>
                    )}
                  />
                  <ComboboxField
                    name="marketDriverName"
                    label="Driver"
                    options={driverOptions}
                    emptyText="No drivers found"
                    searchPlaceholder="Search driver…"
                  />
                </div>
              )}
            </FormSection>

            {/* Goods */}
            <FormSection
              icon={<IconPackage size={16} />}
              title="Goods"
              columns={1}
            >
              <div className="space-y-3">
                {fields.map((field, idx) => {
                  const base = `goods.${idx}` as const;
                  const gErrors = errors.goods?.[idx];
                  return (
                    <div
                      key={field.id}
                      className="relative rounded-lg border bg-muted/20 p-3"
                    >
                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => remove(idx)}
                          className="absolute right-2 top-2 rounded-sm p-1 text-muted-foreground hover:text-red-600"
                          aria-label="Remove goods line"
                        >
                          <IconTrash size={14} />
                        </button>
                      )}
                      <div className="grid gap-3 sm:grid-cols-4">
                        <div className="sm:col-span-2">
                          <FieldLabel required>Goods name</FieldLabel>
                          <Controller
                            name={`${base}.name`}
                            control={form.control}
                            render={({ field }) => (
                              <SuggestInput
                                value={(field.value as string) ?? ""}
                                onChange={(v) => {
                                  field.onChange(v);
                                  prefillGoodsFromMaster(idx, v);
                                }}
                                onBlur={field.onBlur}
                                suggestions={goodsSuggestions}
                                placeholder="Select from master or type — e.g. Steel coils"
                                invalid={Boolean(gErrors?.name?.message)}
                              />
                            )}
                          />
                          <FieldError message={gErrors?.name?.message} />
                        </div>
                        <div>
                          <FieldLabel required>Qty</FieldLabel>
                          <Input
                            {...form.register(`${base}.quantity`)}
                            type="number"
                            min={1}
                            placeholder="0"
                            className="h-9"
                          />
                          <FieldError
                            message={
                              gErrors?.quantity?.message
                                ? String(gErrors.quantity.message)
                                : undefined
                            }
                          />
                        </div>
                        <div>
                          <FieldLabel required>Unit</FieldLabel>
                          <Input
                            {...form.register(`${base}.unit`)}
                            placeholder="MT / PCS"
                            className="h-9"
                          />
                          <FieldError message={gErrors?.unit?.message} />
                        </div>
                        <div className="sm:col-span-2">
                          <FieldLabel>Description</FieldLabel>
                          <Input
                            {...form.register(`${base}.description`)}
                            placeholder="Optional"
                            className="h-9"
                          />
                        </div>
                        <div>
                          <FieldLabel>Weight (kg)</FieldLabel>
                          <Input
                            {...form.register(`${base}.weight`)}
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="0"
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
                  onClick={() => append(EMPTY_GOODS)}
                >
                  <IconPlus size={14} className="mr-1" /> Add goods line
                </Button>
                {typeof errors.goods?.root?.message === "string" && (
                  <p className="text-xs text-red-600">
                    {errors.goods.root.message}
                  </p>
                )}
              </div>
            </FormSection>
          </div>

          {/* RIGHT — order summary */}
          <div className="hidden lg:block">
            <ContextPanel
              source={source}
              order={orderSummary}
              tripLegLabel={tripLegLabel(
                source === "FROM_ORDER"
                  ? String(watchTripLegType ?? "DIRECT")
                  : "DIRECT",
              )}
              selectedTripName={selectedTrip?.tripName}
            />
          </div>
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
              onClick={() =>
                router.push(orderId ? `/orders/${orderId}` : "/lorry-receipts")
              }
            >
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FormProvider>
  );
}
