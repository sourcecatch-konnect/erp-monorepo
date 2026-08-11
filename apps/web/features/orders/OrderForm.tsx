"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, FormProvider, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
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
import {
  IconUser,
  IconTruck,
  IconPhone,
  IconMapPin,
  IconUserCircle,
  IconMail,
  IconTrash,
  IconUserPlus,
  IconAlertTriangle,
} from "@tabler/icons-react";

import FormSection from "../masters/_shared/fields/FormSection";
import ComboboxField from "../masters/_shared/fields/ComboboxField";
import TextAreaField from "../masters/_shared/fields/TextAreaField";
import getErrorMessage from "../masters/_shared/hooks/useMasterMutation";

import { orderApi, orderLookups, orderLookupKeys } from "./order.service";

import ItemLinesEditor from "./components/ItemLinesEditor";
import ConsignmentLinesEditor from "./components/ConsignmentLinesEditor";
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

// Human labels for the validation summary shown above the footer.
const FIELD_LABELS: Record<string, string> = {
  customerId: "Customer (Consignor)",
  consigneeId: "Consignee",
  pickupDate: "Pickup date",
  fromBranchId: "From branch",
  toBranchId: "To branch",
  routeId: "Route",
  customerLocationId: "Saved pickup location",
  pickupAddressOverride: "Pickup address override",
  orderType: "Order type",
  vehicleTypeId: "Vehicle type",
  truckQuantity: "Truck quantity",
  contactPersonName: "Contact person",
  contactMobile: "Mobile number",
  contactEmail: "Email address",
  specialInstructions: "Special instructions",
  items: "Item lines",
  consignments: "Consignment lines",
  goods: "Goods",
  goodsId: "Goods",
  quantity: "Quantity",
  loadingLocationId: "Loading location",
  unloadingLocationId: "Unloading location",
  truckIndex: "Truck",
};

// Singular label used when a key is followed by an array index.
const ARRAY_ITEM_LABELS: Record<string, string> = {
  items: "Item",
  consignments: "Consignment line",
  goods: "Goods",
};

type FlatError = { label: string; message: string };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const humanLabel = (path: string[]): string => {
  const parts: string[] = [];
  for (let i = 0; i < path.length; i++) {
    const seg = path[i];
    if (seg === undefined || /^\d+$/.test(seg)) continue;
    const next = path[i + 1];
    if (next && /^\d+$/.test(next)) {
      const base = ARRAY_ITEM_LABELS[seg] ?? FIELD_LABELS[seg] ?? seg;
      parts.push(`${base} ${Number(next) + 1}`);
    } else {
      parts.push(FIELD_LABELS[seg] ?? seg);
    }
  }
  return parts.join(" · ");
};

// Walk react-hook-form's nested error tree into a flat list of issues.
const collectErrors = (node: unknown, path: string[] = []): FlatError[] => {
  if (!isRecord(node)) return [];
  const msg = node.message;
  if (typeof msg === "string" && msg.length > 0) {
    return [{ label: humanLabel(path), message: msg }];
  }
  const out: FlatError[] = [];
  for (const key of Object.keys(node)) {
    if (key === "ref" || key === "type" || key === "message") continue;
    out.push(...collectErrors(node[key], [...path, key]));
  }
  return out;
};

export default function OrderForm({ mode, order }: Props) {
  const router = useRouter();
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [showContactFields, setShowContactFields] = useState(
    Boolean(
      order?.contactPersonName || order?.contactMobile || order?.contactEmail,
    ),
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
    mode: "onTouched",
    defaultValues: order
      ? {
          customerId: order.customerId,
          consigneeId: order.consigneeId ?? undefined,
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
            })) ?? [],
          consignments:
            order.consignments?.map((c) => ({
              truckIndex: c.truckIndex,
              loadingLocationId: c.loadingLocationId ?? undefined,
              unloadingLocationId: c.unloadingLocationId ?? undefined,
              totalWeight:
                c.totalWeight != null ? Number(c.totalWeight) : undefined,
              goods:
                c.goods && c.goods.length
                  ? c.goods.map((g) => ({
                      goodsId: g.goodsId,
                      quantity: g.quantity,
                    }))
                  : [],
            })) ?? [],
        }
      : {
          orderType: "Truck",
          truckQuantity: 1,
          items: [],
          consignments: [],
        },
  });

  const orderType = form.watch("orderType");
  const customerId = form.watch("customerId");
  const consigneeId = form.watch("consigneeId");
  const consignments = form.watch("consignments");
  const items = form.watch("items");
  const truckQuantity = form.watch("truckQuantity");
  // Bounds the per-line truck selector; falls back to 1 until a quantity is set.
  const truckCount = Math.max(1, Number(truckQuantity) || 1);

  const locations = useQuery({
    queryKey: orderLookupKeys.customerLocations(customerId ?? ""),
    queryFn: () => orderApi.customerLocations(customerId as string),
    enabled: Boolean(customerId),
  });

  // Consignee's saved locations feed the consignment editor's unloading points.
  const consigneeLocations = useQuery({
    queryKey: orderLookupKeys.customerLocations(consigneeId ?? ""),
    queryFn: () => orderApi.customerLocations(consigneeId as string),
    enabled: Boolean(consigneeId),
  });

  const [submitting, setSubmitting] = React.useState(false);

  // When the user flips order type, drop the other type's lines. Both editors
  // seed an empty row on mount, so without this the hidden array's blank rows
  // (e.g. a goods row with no goodsId) keep failing Zod even though that type
  // isn't active. The first run only clears errors (loaded edit data, which is
  // already correct for its type, must not be marked dirty or wiped).
  const didInitOrderType = React.useRef(false);
  React.useEffect(() => {
    const interaction = didInitOrderType.current;
    // Truck orders use `consignments`; Item orders use `items`. Clear the other.
    const inactive = orderType === "Truck" ? "items" : "consignments";
    if (interaction) {
      form.setValue(inactive, [], { shouldDirty: true, shouldValidate: false });
    }
    form.clearErrors(inactive);
    didInitOrderType.current = true;
  }, [orderType, form]);

  const onSubmit = async (values: CreateOrderBody) => {
    if (values.orderType === "Truck") {
      const truckQty = Number(values.truckQuantity) || 0;
      const assignedTrucks = new Set(
        (values.consignments ?? []).map((line) => Number(line.truckIndex)),
      );
      const missingTrucks = Array.from(
        { length: truckQty },
        (_, index) => index + 1,
      ).filter((truckIndex) => !assignedTrucks.has(truckIndex));

      if (missingTrucks.length > 0) {
        const message = `Add at least one LR/consignment line for truck${missingTrucks.length === 1 ? "" : "s"} ${missingTrucks.join(", ")}.`;
        form.setError("consignments", {
          type: "manual",
          message,
        });

        toast.error(message);

        return;
      }
    }

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
        router.push(`/orders/${encodeURIComponent(created.orderNumber)}`);
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

  // Live summary shown on the left of the sticky action bar.
  const footerSummary = React.useMemo(() => {
    if (orderType === "Truck") {
      const lines = consignments?.length ?? 0;
      const trucks = new Set(
        (consignments ?? [])
          .map((c) => Number(c?.truckIndex) || 1)
          .filter((n) => Number.isFinite(n)),
      ).size;
      if (lines === 0) return "Add a consignment line to continue";
      return `${lines} line${lines === 1 ? "" : "s"} · ${trucks} truck${trucks === 1 ? "" : "s"}`;
    }
    const count = items?.length ?? 0;
    return count === 0
      ? "Add an item to continue"
      : `${count} item${count === 1 ? "" : "s"}`;
  }, [orderType, consignments, items]);

  // Flattened validation issues, surfaced above the footer once a save is
  // attempted so the user can see everything they missed at a glance.
  const { errors, submitCount } = form.formState;
  const validationIssues = React.useMemo(() => collectErrors(errors), [errors]);
  const showValidationSummary = submitCount > 0 && validationIssues.length > 0;

  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="mx-auto relative w-full max-w-4xl space-y-5 pb-20"
      >
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            {mode === "edit"
              ? `Edit Order ${order?.orderNumber}`
              : "Create New Order"}
          </h1>

          <p className="mt-1 text-xs text-muted-foreground">
            {mode === "edit"
              ? "Update order details and save changes."
              : "Create a new booking request and submit it for approval."}
          </p>

          {softOnly ? (
            <p className="mt-2 rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
              Confirmed order — only contact details and instructions are
              editable.
            </p>
          ) : null}
        </div>

        <div className="grid gap-4">
          <FormSection
            icon={<IconUser size={16} />}
            title="Customer & Route"
            columns={2}
          >
            <ComboboxField
              name="customerId"
              label="Customer (Consignor)"
              required
              options={toOptions(customers.data ?? [])}
              disabled={softOnly}
            />

            <ComboboxField
              name="consigneeId"
              label="Consignee"
              options={toOptions(customers.data ?? [])}
              emptyText="No customers found"
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
              options={(routes.data ?? []).map((route) => ({
                label: `${route.sourceCity?.name ?? "-"} → ${route.destinationCity?.name ?? "-"}`,
                value: route.id,
              }))}
              emptyText="No routes found"
              disabled={softOnly}
            />
            {orderType === "Item" && (
              <>
                <ComboboxField
                  name="customerLocationId"
                  label="Saved pickup location"
                  options={toOptions(
                    (locations.data ?? []).map((l) => ({
                      id: l.id,
                      name: l.name,
                    })),
                  )}
                  emptyText={
                    customerId
                      ? "No saved locations"
                      : "Select a customer first"
                  }
                  disabled={softOnly || !customerId}
                />

                <IconTextField<CreateOrderFormInput>
                  name="pickupAddressOverride"
                  label="Pickup address override"
                  placeholder="Use only if pickup address is different"
                  icon={<IconMapPin size={16} />}
                />
              </>
            )}
          </FormSection>

          <FormSection
            icon={<IconTruck size={16} />}
            title="Order Details"
            columns={2}
          >
            {/* Order type — segmented control with an animated active pill. */}
            <div className="col-span-full">
              <div className="inline-flex rounded-lg border bg-muted/40 p-1">
                {(["Truck", "Item"] as const).map((t) => {
                  const active = orderType === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={softOnly}
                      onClick={() =>
                        form.setValue("orderType", t, { shouldDirty: true })
                      }
                      className={[
                        "relative rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                        active
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                        softOnly ? "cursor-not-allowed opacity-60" : "",
                      ].join(" ")}
                    >
                      {active && (
                        <motion.span
                          layoutId="orderTypePill"
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 32,
                          }}
                          className="absolute inset-0 -z-0 rounded-md bg-background shadow-sm ring-1 ring-border"
                        />
                      )}
                      <span className="relative z-10 inline-flex items-center gap-1.5">
                        <IconTruck
                          size={15}
                          className={active ? "text-primary" : ""}
                        />
                        {t === "Truck" ? "Truck hire" : "Item / Goods"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {orderType === "Truck"
                  ? "Book one or more trucks by vehicle type, then add consignment lines."
                  : "Add goods line items with quantity."}
              </p>
            </div>

            {orderType === "Truck" ? (
              <div className="col-span-full space-y-5">
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

                {!softOnly && (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium">Consignment lines</p>
                      <p className="text-xs text-muted-foreground">
                        One LR per line. Add a line for each loading → unloading
                        pair; list every invoice for that pair as a goods row on
                        the same line.
                      </p>
                    </div>
                    <ConsignmentLinesEditor
                      goodsOptions={toOptions(goods.data ?? [])}
                      loadingOptions={toOptions(
                        (locations.data ?? []).map((l) => ({
                          id: l.id,
                          name: l.name,
                        })),
                      )}
                      unloadingOptions={toOptions(
                        (consigneeLocations.data ?? []).map((l) => ({
                          id: l.id,
                          name: l.name,
                        })),
                      )}
                      consigneeChosen={Boolean(consigneeId)}
                      truckCount={truckCount}
                    />
                  </div>
                )}
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
                    <p className="text-sm font-medium">
                      Additional contact details
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Add a pickup contact person if different from the
                      customer.
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
                      form.setValue("contactPersonName", "", {
                        shouldDirty: true,
                      });
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

        <motion.div
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="sticky bottom-0 z-20 border-t border-border/70 bg-background/80 py-3 backdrop-blur-md"
        >
          {showValidationSummary ? (
            <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <div className="flex items-start gap-2">
                <IconAlertTriangle
                  size={16}
                  className="mt-0.5 shrink-0 text-destructive"
                />
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium text-destructive">
                    Please fix {validationIssues.length}{" "}
                    {validationIssues.length === 1 ? "issue" : "issues"} before
                    saving
                  </p>
                  <ul className="space-y-0.5">
                    {validationIssues.map((issue, i) => (
                      <li
                        key={`${issue.label}-${i}`}
                        className="text-xs text-destructive/90"
                      >
                        <span className="font-medium">{issue.label}:</span>{" "}
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">{footerSummary}</p>

            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={handleCancel}>
                Cancel
              </Button>

              <Button type="submit" disabled={submitting} className="min-w-28">
                {submitting
                  ? "Saving…"
                  : mode === "edit" && order?.status === "Rejected"
                    ? "Resubmit"
                    : "Save Order"}
              </Button>
            </div>
          </div>
        </motion.div>
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
