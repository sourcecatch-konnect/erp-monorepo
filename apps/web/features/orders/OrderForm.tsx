"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, FormProvider, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { createOrderSchema } from "@skerp/validators";
import type {
  CreateOrderFormInput,
  CreateOrderBody,
  Order,
} from "@skerp/types";
import type { ComboboxOption } from "@skerp/ui/components/combobox";
import { Button } from "@skerp/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { IconUser, IconTruck, IconPhone, IconMapPin, IconUserCircle, IconMail, IconTrash, IconUserPlus } from "@tabler/icons-react";

import FormSection from "../masters/_shared/fields/FormSection";
import ComboboxField from "../masters/_shared/fields/ComboboxField";
import TextField from "../masters/_shared/fields/TextField";
import TextAreaField from "../masters/_shared/fields/TextAreaField";
import getErrorMessage from "../masters/_shared/hooks/useMasterMutation";

import { orderApi, orderLookups, orderLookupKeys } from "./order.service";

import ItemLinesEditor from "./components/ItemLinesEditor";
import { DatePicker } from "@skerp/ui/components/datepicker";
import IconTextField from "../masters/_shared/fields/IconTextField";
import { useState } from "react";

type Props = {
  mode: "create" | "edit";
  order?: Order;
};

const toOptions = (rows: { id: string; name: string }[]): ComboboxOption[] =>
  rows.map((r) => ({ label: r.name, value: r.id }));

const dateInputValue = (iso?: string | null) =>
  iso ? new Date(iso).toISOString().slice(0, 10) : "";

export default function OrderForm({ mode, order }: Props) {
  const router = useRouter();
  const [discardOpen, setDiscardOpen] = React.useState(false);
const [showContactFields, setShowContactFields] = useState(
  Boolean(order?.contactPersonName || order?.contactMobile || order?.contactEmail),
);
  const softOnly = mode === "edit" && order?.status === "Confirmed";

  const customers = useQuery({
    queryKey: orderLookupKeys.customers,
    queryFn: orderLookups.customers,
  });
  const branches = useQuery({
    queryKey: orderLookupKeys.branches,
    queryFn: orderLookups.branches,
  });
  const goods = useQuery({
    queryKey: orderLookupKeys.goods,
    queryFn: orderLookups.goods,
  });
  const vehicleTypes = useQuery({
    queryKey: orderLookupKeys.vehicleTypes,
    queryFn: orderLookups.vehicleTypes,
  });
const routes = useQuery({
  queryKey: orderLookupKeys.routes,
  queryFn: orderLookups.routes,
});
  const form = useForm<CreateOrderFormInput, unknown, CreateOrderBody>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: order
      ? {
          customerId: order.customerId,
          fromBranchId: order.fromBranchId,
          toBranchId: order.toBranchId,
          pickupDate: dateInputValue(order.pickupDate),
          customerLocationId: order.customerLocationId ?? undefined,
          pickupAddressOverride: order.pickupAddressOverride ?? undefined,
          specialInstructions: order.specialInstructions ?? undefined,
          orderType: order.orderType,
          routeId: order.routeId ?? undefined,
          truckQuantity: order.truckQuantity ?? undefined,
          vehicleTypeId: order.vehicleTypeId ?? undefined,
          contactPersonName: order.contactPersonName ?? undefined,
          contactMobile: order.contactMobile ?? undefined,
          contactEmail: order.contactEmail ?? undefined,
          items:
            order.items?.map((i) => ({
              goodsId: i.goodsId,
              quantity: i.quantity,
              unit: i.unit,
              weight: i.weight ? Number(i.weight) : undefined,
            })) ?? [],
        }
      : {
          orderType: "Truck",
          truckQuantity: 1,
          items: [],
        },
  });

  const orderType = form.watch("orderType");
  const customerId = form.watch("customerId");

  const locations = useQuery({
    queryKey: orderLookupKeys.customerLocations(customerId ?? ""),
    queryFn: () => orderApi.customerLocations(customerId as string),
    enabled: Boolean(customerId),
  });

  const [submitting, setSubmitting] = React.useState(false);

  const onSubmit = async (values: CreateOrderBody) => {
    setSubmitting(true);
    try {
      if (mode === "edit" && order) {
        await orderApi.update(order.id, { ...values, version: order.version });
        toast.success(
          order.status === "Rejected"
            ? "Order resubmitted for approval"
            : "Order updated",
        );
        router.push(`/orders/${encodeURIComponent(order.orderNumber)}`);
      } else {
        const created = await orderApi.create(values);
        toast.success(
          `Order ${created.orderNumber} created and sent for approval`,
        );
        router.push(`/orders/${created.id}`);
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (form.formState.isDirty) setDiscardOpen(true);
    else router.push("/orders");
  };

  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
       className="mx-auto max-w-6xl space-y-5 p-4 md:p-6"
      >
       <div className="rounded-lg border bg-background p-4 shadow-sm">
  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <div>
      <h1 className="text-lg font-semibold tracking-tight">
        {mode === "edit" ? `Edit Order ${order?.orderNumber}` : "Create New Order"}
      </h1>

      <p className="mt-1 text-xs text-muted-foreground">
        {mode === "edit"
          ? "Update order details and save changes."
          : "Create a new booking request and submit it for approval."}
      </p>

      {softOnly ? (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
          Confirmed order — only contact details and instructions are editable.
        </p>
      ) : null}
    </div>

    <div className="flex gap-2">
      <Button type="button" variant="outline" onClick={handleCancel}>
        Cancel
      </Button>

      <Button type="submit" disabled={submitting}>
        {submitting
          ? "Saving…"
          : mode === "edit" && order?.status === "Rejected"
            ? "Resubmit"
            : "Save Order"}
      </Button>
    </div>
  </div>
</div>

        <div className="grid gap-4">
       <FormSection
  icon={<IconUser size={16} />}
  title="Customer & Route"
  columns={2}
>
  <ComboboxField
    name="customerId"
    label="Customer"
    required
    options={toOptions(customers.data ?? [])}
    disabled={softOnly}
  />

  <Controller
    control={form.control}
    name="pickupDate"
    render={({ field }) => (
      <div className="grid gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Pickup date <span className="text-red-600">*</span>
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
          disabled={{ before: new Date() }}
        />

        {form.formState.errors.pickupDate?.message ? (
          <p className="text-xs text-red-600">
            {String(form.formState.errors.pickupDate.message)}
          </p>
        ) : null}
      </div>
    )}
  />

  <ComboboxField
    name="fromBranchId"
    label="From branch"
    required
    options={toOptions(branches.data ?? [])}
    disabled={softOnly}
  />

  <ComboboxField
    name="toBranchId"
    label="To branch"
    required
    options={toOptions(branches.data ?? [])}
    disabled={softOnly}
  />
<ComboboxField
  name="routeId"
  label="Route"
  required
  options={(routes.data ?? []).map((route) => ({
    label: `${route.sourceCity?.name ?? "-"} → ${route.destinationCity?.name ?? "-"}`,
    value: route.id,
  }))}
  emptyText="No routes found"
  disabled={softOnly}
/>
  <ComboboxField
    name="customerLocationId"
    label="Saved pickup location"
    options={toOptions(
      (locations.data ?? []).map((l) => ({ id: l.id, name: l.name })),
    )}
    emptyText={customerId ? "No saved locations" : "Select a customer first"}
    disabled={softOnly || !customerId}
  />

  <IconTextField<CreateOrderFormInput>
    name="pickupAddressOverride"
    label="Pickup address override"
    placeholder="Use only if pickup address is different"
    icon={<IconMapPin size={16} />}
  />
</FormSection>

          <FormSection
            icon={<IconTruck size={16} />}
            title="Order Details"
            columns={2}
          >
         <div className="col-span-full grid gap-3 md:grid-cols-2">
  {(["Truck", "Item"] as const).map((t) => {
    const active = orderType === t;

    return (
      <button
        key={t}
        type="button"
        disabled={softOnly}
        onClick={() => form.setValue("orderType", t, { shouldDirty: true })}
        className={[
          "rounded-lg border p-4 text-left transition",
          active
            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
            : "bg-background hover:bg-muted/40",
          softOnly ? "cursor-not-allowed opacity-60" : "",
        ].join(" ")}
      >
        <div className="flex items-center gap-2">
          <IconTruck size={16} className={active ? "text-primary" : ""} />
          <p className="text-sm font-medium">
            {t === "Truck" ? "Truck hire" : "Item / Goods"}
          </p>
        </div>

        <p className="mt-1 text-xs text-muted-foreground">
          {t === "Truck"
            ? "Book one or more trucks by vehicle type."
            : "Add goods line items with quantity and weight."}
        </p>
      </button>
    );
  })}
</div>
          {orderType === "Truck" ? (
  <div className="col-span-full rounded-lg border bg-muted/10 p-4">
    <div className="grid gap-4 md:grid-cols-2">
      <ComboboxField
        name="vehicleTypeId"
        label="Vehicle type"
        required
        options={toOptions(
          (vehicleTypes.data ?? []).map((v) => ({
            id: v.id,
            name: v.name,
          })),
        )}
        disabled={softOnly}
      />

      <IconTextField<CreateOrderFormInput>
        name="truckQuantity"
        label="Truck quantity"
        placeholder="1"
        type="number"
        min={1}
        suffix="trucks"
        required
        disabled={softOnly}
      />
    </div>
  </div>
) : (
  <div className="col-span-full">
    <ItemLinesEditor goodsOptions={toOptions(goods.data ?? [])} />
  </div>
)}
          </FormSection>

    <FormSection
  icon={<IconPhone size={16} />}
  title="Contact & Notes"
  columns={2}
>
  {!showContactFields ? (
    <div className="col-span-full rounded-lg border border-dashed bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Additional contact details</p>
          <p className="text-xs text-muted-foreground">
            Add a pickup contact person if different from the customer.
          </p>
        </div>

<Button
  type="button"
  variant="default"
  size="sm"
  className="gap-1.5"
  onClick={() => setShowContactFields(true)}
>
  <IconUserPlus size={14} />
  Add contact
</Button>
      </div>
    </div>
  ) : (
    <div className="col-span-full rounded-lg border bg-muted/10 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Contact details</p>
          <p className="text-xs text-muted-foreground">
            Used for pickup and delivery coordination.
          </p>
        </div>

    <Button
  type="button"
  variant="ghost"
  size="sm"
  className="text-muted-foreground hover:bg-red-50 hover:text-red-600"
  onClick={() => {
    setShowContactFields(false);
    form.setValue("contactPersonName", "", { shouldDirty: true });
    form.setValue("contactMobile", "", { shouldDirty: true });
    form.setValue("contactEmail", "", { shouldDirty: true });
  }}
>
  <IconTrash size={14} />
  Remove
</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <IconTextField<CreateOrderFormInput>
          name="contactPersonName"
          label="Contact person"
          placeholder="Enter name"
          icon={<IconUserCircle size={16} />}
        />

        <IconTextField<CreateOrderFormInput>
          name="contactMobile"
          label="Mobile number"
          placeholder="10-digit mobile"
          prefix="+91"
          maxLength={10}
        />

        <IconTextField<CreateOrderFormInput>
          name="contactEmail"
          label="Email address"
          placeholder="example@company.com"
          type="email"
          icon={<IconMail size={16} />}
        />
      </div>
    </div>
  )}

  <div className="col-span-full">
    <TextAreaField
      name="specialInstructions"
      label="Special instructions"
      placeholder="Any pickup, delivery, billing, or handling notes"
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
              onClick={() => router.push("/orders")}
            >
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FormProvider>
  );
}
