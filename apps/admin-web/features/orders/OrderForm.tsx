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
import { IconUser, IconTruck, IconPhone } from "@tabler/icons-react";

import FormSection from "../masters/_shared/fields/FormSection";
import ComboboxField from "../masters/_shared/fields/ComboboxField";
import TextField from "../masters/_shared/fields/TextField";
import TextAreaField from "../masters/_shared/fields/TextAreaField";
import getErrorMessage from "../masters/_shared/hooks/useMasterMutation";

import { orderApi, orderLookups, orderLookupKeys } from "./order.service";

import ItemLinesEditor from "./components/ItemLinesEditor";
import { DatePicker } from "@skerp/ui/components/datepicker";

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
        router.push(`/orders/${order.id}`);
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
        className="mx-auto max-w-5xl space-y-4 p-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">
              {mode === "edit"
                ? `Edit Order ${order?.orderNumber}`
                : "New Order"}
            </h1>
            {softOnly ? (
              <p className="text-xs text-muted-foreground">
                Confirmed order — only contact &amp; instructions are editable.
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
                  : "Save"}
            </Button>
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
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Pickup date <span className="text-red-600">*</span>
              </label>
              <Controller
                control={form.control}
                name="pickupDate"
                render={({ field }) => (
                  <DatePicker
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={{ before: new Date() }}
                  />
                )}
              />

              {form.formState.errors.pickupDate?.message ? (
                <p className="text-xs text-red-600">
                  {String(form.formState.errors.pickupDate.message)}
                </p>
              ) : null}
            </div>
            <ComboboxField
              name="customerLocationId"
              label="Pickup location"
              options={toOptions(
                (locations.data ?? []).map((l) => ({ id: l.id, name: l.name })),
              )}
              emptyText={
                customerId ? "No saved locations" : "Select a customer first"
              }
              disabled={softOnly || !customerId}
            />
            <TextField
              name="pickupAddressOverride"
              label="Pickup address override"
              placeholder="For walk-in / ad-hoc pickups"
            />
          </FormSection>

          <FormSection
            icon={<IconTruck size={16} />}
            title="Order Details"
            columns={2}
          >
            <div className="col-span-full flex gap-2">
              {(["Truck", "Item"] as const).map((t) => (
                <Button
                  key={t}
                  type="button"
                  variant={orderType === t ? "default" : "outline"}
                  size="sm"
                  disabled={softOnly}
                  onClick={() =>
                    form.setValue("orderType", t, { shouldDirty: true })
                  }
                >
                  {t === "Truck" ? "Truck hire" : "Item / Goods"}
                </Button>
              ))}
            </div>

            {orderType === "Truck" ? (
              <>
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
                <div className="grid gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Truck quantity <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    className="h-10 rounded-lg border bg-background px-3 text-sm"
                    disabled={softOnly}
                    {...form.register("truckQuantity")}
                  />
                  {form.formState.errors.truckQuantity?.message ? (
                    <p className="text-xs text-red-600">
                      {String(form.formState.errors.truckQuantity.message)}
                    </p>
                  ) : null}
                </div>
              </>
            ) : (
              <ItemLinesEditor goodsOptions={toOptions(goods.data ?? [])} />
            )}
          </FormSection>

          <FormSection
            icon={<IconPhone size={16} />}
            title="Contact & Notes"
            columns={2}
          >
            <TextField name="contactPersonName" label="Contact person" />
            <TextField name="contactMobile" label="Contact mobile" />
            <TextField name="contactEmail" label="Contact email" />
            <TextAreaField
              name="specialInstructions"
              label="Special instructions"
            />
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
