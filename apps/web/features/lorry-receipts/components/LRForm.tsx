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
  IconRoute,
} from "@tabler/icons-react";

import { createLRGroupSchema } from "@skerp/validators/lr-group";
import type { CreateLRGroupFormInput, CreateLRGroupBody } from "@skerp/types";
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

type Props = {
  orderId?: string;
  /** Instant group launched from a Planned trip — preselects that trip. */
  tripId?: string;
};

const EMPTY_LINE = {
  loadingLocationId: undefined as string | undefined,
  unloadingLocationId: undefined as string | undefined,
  goods: [{ name: "", description: "", quantity: "" as unknown as number, unit: "", weight: "" as unknown as number }],
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

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1 block text-xs font-medium text-muted-foreground">
      {children}
      {required && <span className="ml-0.5 text-red-600">*</span>}
    </label>
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
  const [submitting, setSubmitting] = React.useState(false);

  const source = orderId ? "FROM_ORDER" : "INSTANT";

  const customers = useQuery({ queryKey: lrLookupKeys.customers, queryFn: lrLookups.customers });
  const branches = useQuery({ queryKey: lrLookupKeys.branches, queryFn: lrLookups.branches });
  const railheads = useQuery({
    queryKey: lrLookupKeys.railheadBranches,
    queryFn: lrLookups.railheadBranches,
    enabled: source === "FROM_ORDER",
  });
  const trips = useQuery({ queryKey: lrLookupKeys.attachableTrips, queryFn: lrLookups.attachableTrips });
  const goodsMaster = useQuery({ queryKey: lrLookupKeys.goods, queryFn: lrLookups.goods });

  const form = useForm<CreateLRGroupFormInput, unknown, CreateLRGroupBody>({
    resolver: zodResolver(createLRGroupSchema),
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
            lrs: [EMPTY_LINE],
          },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lrs" });
  const errors = form.formState.errors;

  const [watchIsMarket, watchTransport, watchConsignor, watchConsignee] = useWatch({
    control: form.control,
    name: [
      "isMarketVehicle",
      source === "FROM_ORDER" ? "transportType" : "transportType",
      source === "INSTANT" ? "consignorId" : "orderId",
      source === "INSTANT" ? "consigneeId" : "orderId",
    ],
  });

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
  const branchOptions = (branches.data ?? []).map((b) => ({ value: b.value, label: b.label }));
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
  const loadingOptions = (consignorLocations.data ?? []).map((l) => ({ value: l.value, label: l.label }));
  const unloadingOptions = (consigneeLocations.data ?? []).map((l) => ({ value: l.value, label: l.label }));

  const showRailhead = source === "FROM_ORDER" && (watchTransport as string) === "RoadAndRail";

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

  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="mx-auto max-w-4xl space-y-5 p-4 md:p-6"
      >
        <div className="flex flex-col gap-3 rounded-lg border bg-background p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-lg font-semibold">
              {source === "FROM_ORDER" ? "Create LR Group from Order" : "Create Instant LR Group"}
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {source === "FROM_ORDER"
                ? "LRs are generated from the order's consignment lines for the chosen truck."
                : "Standalone Road group — declare each consignment line below."}
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
              onClick={() => router.push(orderId ? `/orders/${orderId}` : "/lorry-receipts")}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create group"}
            </Button>
          </div>
        </div>

        {source === "FROM_ORDER" && (
          <FormSection icon={<IconRoute size={16} />} title="Truck & transport" columns={2}>
            <div>
              <FieldLabel required>Truck #</FieldLabel>
              <Input {...form.register("truckIndex")} type="number" min={1} className="h-9" />
            </div>
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
                        form.setValue("railheadBranchId" as never, undefined as never);
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
                options={(railheads.data ?? []).map((b) => ({ value: b.value, label: b.label }))}
                emptyText="No railhead branches found"
              />
            )}
          </FormSection>
        )}

        {source === "INSTANT" && (
          <FormSection icon={<IconUsers size={16} />} title="Parties" columns={2}>
            <ComboboxField name="consignorId" label="Consignor" required options={customerOptions} />
            <ComboboxField name="consigneeId" label="Consignee" required options={customerOptions} />
            <ComboboxField name="originBranchId" label="Origin branch" required options={branchOptions} />
            <ComboboxField
              name="destinationBranchId"
              label="Destination branch"
              required
              options={branchOptions}
            />
          </FormSection>
        )}

        {/* Vehicle */}
        <FormSection icon={<IconTruck size={16} />} title="Vehicle" columns={1}>
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
            <div className="mt-3 max-w-xl">
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
                    <Input
                      value={(field.value as string) ?? ""}
                      onChange={field.onChange}
                      placeholder="e.g. MH12AB1234"
                      className="h-9"
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
                    <Input
                      value={(field.value as string) ?? ""}
                      onChange={field.onChange}
                      placeholder="Driver name"
                      className="h-9"
                    />
                  </div>
                )}
              />
            </div>
          )}
        </FormSection>

        {/* Consignment lines (INSTANT only — FROM_ORDER reads from the order) */}
        {source === "INSTANT" && (
          <FormSection icon={<IconPackage size={16} />} title="Consignments (one LR each)" columns={1}>
            <div className="space-y-3">
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
                  <div key={field.id} className="relative rounded-lg border bg-muted/20 p-3">
                    {fields.length > 1 && (
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
                        emptyText={watchConsignor ? "No saved locations" : "Pick a consignor first"}
                      />
                      <ComboboxField
                        name={`${base}.unloadingLocationId`}
                        label="Unloading point"
                        options={unloadingOptions}
                        emptyText={watchConsignee ? "No saved locations" : "Pick a consignee first"}
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
                              invalid={Boolean(lineErr?.goods?.[0]?.name?.message)}
                            />
                          )}
                        />
                      </div>
                      <div>
                        <FieldLabel required>Qty</FieldLabel>
                        <Input {...form.register(`${base}.goods.0.quantity`)} type="number" min={1} className="h-9" />
                      </div>
                      <div>
                        <FieldLabel required>Unit</FieldLabel>
                        <Input {...form.register(`${base}.goods.0.unit`)} placeholder="MT / PCS" className="h-9" />
                      </div>
                    </div>
                  </div>
                );
              })}
              <Button type="button" variant="outline" size="sm" onClick={() => append(EMPTY_LINE)}>
                <IconPlus size={14} className="mr-1" /> Add consignment line
              </Button>
            </div>
          </FormSection>
        )}
      </form>
    </FormProvider>
  );
}
