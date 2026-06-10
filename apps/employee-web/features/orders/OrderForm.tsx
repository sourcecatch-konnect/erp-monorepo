"use client";

import * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    useForm, FormProvider, Controller, useFieldArray,
} from "react-hook-form";
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
import { Input } from "@skerp/ui/components/input";
import { Textarea } from "@skerp/ui/components/textarea";
import { Combobox } from "@skerp/ui/components/combobox";
import { DatePicker } from "@skerp/ui/components/datepicker";
import {
    Dialog, DialogContent, DialogDescription,
    DialogFooter, DialogHeader, DialogTitle,
} from "@skerp/ui/components/dialog";
import {
    IconUser, IconTruck, IconPhone, IconMapPin,
    IconUserCircle, IconMail, IconTrash, IconUserPlus, IconPlus,
} from "@tabler/icons-react";

import { orderApi, orderLookups, orderLookupKeys } from "./order.service";
import getErrorMessage from "./_shared/getErrorMessage";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
type Props = { mode: "create" | "edit"; order?: Order };
type FormValues = CreateOrderFormInput;

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */
const UNIT_OPTIONS: ComboboxOption[] = [
    { label: "MT", value: "MT" },
    { label: "Kg", value: "Kg" },
    { label: "Nos", value: "Nos" },
    { label: "Boxes", value: "Boxes" },
    { label: "Bags", value: "Bags" },
    { label: "Pallets", value: "Pallets" },
];

/* ------------------------------------------------------------------ */
/* Tiny layout primitives — zero external dependency                  */
/* ------------------------------------------------------------------ */
function FormSection({
    icon, title, children,
}: {
    icon?: React.ReactNode;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2 border-b pb-3">
                {icon && <span className="text-muted-foreground">{icon}</span>}
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {title}
                </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {children}
            </div>
        </section>
    );
}

function FieldWrapper({
    label, required, error, children, fullWidth,
}: {
    label: string;
    required?: boolean;
    error?: string;
    children: React.ReactNode;
    fullWidth?: boolean;
}) {
    return (
        <div className={`grid gap-1.5 ${fullWidth ? "sm:col-span-2" : ""}`}>
            <label className="text-xs font-medium text-muted-foreground">
                {label}
                {required && <span className="ml-0.5 text-red-600">*</span>}
            </label>
            {children}
            {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const toOptions = (rows: { id: string; name: string }[]): ComboboxOption[] =>
    rows.map((r) => ({ label: r.name, value: r.id }));

const dateInputValue = (iso?: string | null) =>
    iso ? new Date(iso).toISOString().slice(0, 10) : "";

/* ------------------------------------------------------------------ */
/* OrderForm                                                           */
/* ------------------------------------------------------------------ */
export default function OrderForm({ mode, order }: Props) {
    const router = useRouter();
    const [discardOpen, setDiscardOpen] = React.useState(false);
    const [submitting, setSubmitting] = React.useState(false);
    const [showContact, setShowContact] = useState(
        Boolean(
            order?.contactPersonName ||
            order?.contactMobile ||
            order?.contactEmail
        )
    );

    const softOnly = mode === "edit" && order?.status === "Confirmed";

    /* ---------------------------------------------------------------- */
    /* Lookups                                                           */
    /* ---------------------------------------------------------------- */
    const customers = useQuery({
        queryKey: orderLookupKeys.customers,
        queryFn: orderLookups.customers,
        staleTime: 5 * 60 * 1000,
    });
    const branches = useQuery({
        queryKey: orderLookupKeys.branches,
        queryFn: orderLookups.branches,
        staleTime: 5 * 60 * 1000,
    });
    const goods = useQuery({
        queryKey: orderLookupKeys.goods,
        queryFn: orderLookups.goods,
        staleTime: 5 * 60 * 1000,
    });
    const vehicleTypes = useQuery({
        queryKey: orderLookupKeys.vehicleTypes,
        queryFn: orderLookups.vehicleTypes,
        staleTime: 5 * 60 * 1000,
    });

    /* ---------------------------------------------------------------- */
    /* Form                                                              */
    /* ---------------------------------------------------------------- */
    const form = useForm<FormValues, unknown, CreateOrderBody>({
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
                items: order.items?.map((i) => ({
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

    const {
        control,
        watch,
        setValue,
        handleSubmit,
        formState: { errors, isDirty },
    } = form;

    const orderType = watch("orderType");
    const customerId = watch("customerId");

    /* Customer locations — enabled only once a customer is chosen */
    const locations = useQuery({
        queryKey: orderLookupKeys.customerLocations(customerId ?? ""),
        queryFn: () => orderApi.customerLocations(customerId as string),
        enabled: Boolean(customerId),
        staleTime: 2 * 60 * 1000,
    });

    /* ---------------------------------------------------------------- */
    /* Item lines via useFieldArray                                      */
    /* ---------------------------------------------------------------- */
    const { fields, append, remove } = useFieldArray<FormValues, "items">({
        control,
        name: "items",
    });

    /* Auto-add one empty row when switching to Item type */
    React.useEffect(() => {
        if (orderType === "Item" && fields.length === 0) {
            append({ goodsId: "", quantity: 1, unit: "MT", weight: undefined });
        }
    }, [orderType, fields.length, append]);

    const addRow = () =>
        append({ goodsId: "", quantity: 1, unit: "MT", weight: undefined });

    /* ---------------------------------------------------------------- */
    /* Submit                                                            */
    /* ---------------------------------------------------------------- */
    const onSubmit = async (values: CreateOrderBody) => {
        setSubmitting(true);
        try {
            if (mode === "edit" && order) {
                await orderApi.update(order.id, { ...values, version: order.version });
                toast.success(
                    order.status === "Rejected"
                        ? "Order resubmitted for approval"
                        : "Order updated"
                );
                router.push(`/orders/${order.id}`);
            } else {
                const created = await orderApi.create(values);
                toast.success(
                    `Order ${created.orderNumber} created and sent for approval`
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
        if (isDirty) {
            setDiscardOpen(true);
        } else {
            router.push(mode === "edit" && order ? `/orders/${order.id}` : "/orders");
        }
    };

    /* ---------------------------------------------------------------- */
    /* Render                                                            */
    /* ---------------------------------------------------------------- */
    return (
        <FormProvider {...form}>
            <form
                onSubmit={handleSubmit(onSubmit)}
                className="mx-auto max-w-4xl space-y-5 p-4 md:p-6"
            >
                {/* ── Page header ── */}
                <div className="rounded-xl border bg-background p-4 shadow-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h1 className="text-lg font-semibold tracking-tight">
                                {mode === "edit"
                                    ? `Edit Order ${order?.orderNumber}`
                                    : "Create New Order"}
                            </h1>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {mode === "edit"
                                    ? "Update order details and save changes."
                                    : "Submit a new booking request for approval."}
                            </p>
                            {softOnly && (
                                <p className="mt-2 rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
                                    Confirmed order — only contact details and instructions are
                                    editable.
                                </p>
                            )}
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

                {/* ── Customer & Route ── */}
                <FormSection icon={<IconUser size={16} />} title="Customer & Route">
                    {/* Customer */}
                    <FieldWrapper
                        label="Customer"
                        required
                        error={errors.customerId?.message}
                    >
                        <Controller
                            control={control}
                            name="customerId"
                            render={({ field }) => (
                                <Combobox
                                    options={toOptions(customers.data ?? [])}
                                    value={field.value ?? undefined}
                                    onChange={field.onChange}
                                    placeholder="Select customer"
                                    disabled={softOnly}
                                    invalid={Boolean(errors.customerId)}
                                />
                            )}
                        />
                    </FieldWrapper>

                    {/* Pickup date */}
                    <FieldWrapper
                        label="Pickup date"
                        required
                        error={errors.pickupDate?.message as string | undefined}
                    >
                        <Controller
                            control={control}
                            name="pickupDate"
                            render={({ field }) => (
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
                            )}
                        />
                    </FieldWrapper>

                    {/* From branch */}
                    <FieldWrapper
                        label="From branch"
                        required
                        error={errors.fromBranchId?.message}
                    >
                        <Controller
                            control={control}
                            name="fromBranchId"
                            render={({ field }) => (
                                <Combobox
                                    options={toOptions(branches.data ?? [])}
                                    value={field.value ?? undefined}
                                    onChange={field.onChange}
                                    placeholder="Select branch"
                                    disabled={softOnly}
                                    invalid={Boolean(errors.fromBranchId)}
                                />
                            )}
                        />
                    </FieldWrapper>

                    {/* To branch */}
                    <FieldWrapper
                        label="To branch"
                        required
                        error={errors.toBranchId?.message}
                    >
                        <Controller
                            control={control}
                            name="toBranchId"
                            render={({ field }) => (
                                <Combobox
                                    options={toOptions(branches.data ?? [])}
                                    value={field.value ?? undefined}
                                    onChange={field.onChange}
                                    placeholder="Select branch"
                                    disabled={softOnly}
                                    invalid={Boolean(errors.toBranchId)}
                                />
                            )}
                        />
                    </FieldWrapper>

                    {/* Saved pickup location */}
                    <FieldWrapper label="Saved pickup location">
                        <Controller
                            control={control}
                            name="customerLocationId"
                            render={({ field }) => (
                                <Combobox
                                    options={toOptions(
                                        (locations.data ?? []).map((l) => ({
                                            id: l.id,
                                            name: l.name,
                                        }))
                                    )}
                                    value={field.value ?? undefined}
                                    onChange={field.onChange}
                                    placeholder="Select location"
                                    emptyText={
                                        customerId ? "No saved locations" : "Select a customer first"
                                    }
                                    disabled={softOnly || !customerId}
                                />
                            )}
                        />
                    </FieldWrapper>

                    {/* Pickup address override */}
                    <FieldWrapper
                        label="Pickup address override"
                        error={errors.pickupAddressOverride?.message}
                    >
                        <div className="flex items-center rounded-md border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
                            <IconMapPin size={15} className="shrink-0 text-muted-foreground" />
                            <Controller
                                control={control}
                                name="pickupAddressOverride"
                                render={({ field }) => (
                                    <Input
                                        {...field}
                                        value={field.value ?? ""}
                                        placeholder="Only if different from saved location"
                                        disabled={softOnly}
                                        className="border-0 shadow-none focus-visible:ring-0"
                                    />
                                )}
                            />
                        </div>
                    </FieldWrapper>
                </FormSection>

                {/* ── Order Details ── */}
                <FormSection icon={<IconTruck size={16} />} title="Order Details">
                    {/* Order type selector */}
                    <div className="sm:col-span-2 grid grid-cols-2 gap-3">
                        {(["Truck", "Item"] as const).map((t) => {
                            const active = orderType === t;
                            return (
                                <button
                                    key={t}
                                    type="button"
                                    disabled={softOnly}
                                    onClick={() =>
                                        setValue("orderType", t, { shouldDirty: true })
                                    }
                                    className={[
                                        "rounded-xl border p-4 text-left transition",
                                        active
                                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                            : "bg-background hover:bg-muted/40",
                                        softOnly ? "cursor-not-allowed opacity-60" : "",
                                    ].join(" ")}
                                >
                                    <div className="flex items-center gap-2">
                                        <IconTruck
                                            size={16}
                                            className={active ? "text-primary" : "text-muted-foreground"}
                                        />
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

                    {/* Truck fields */}
                    {orderType === "Truck" && (
                        <div className="sm:col-span-2 rounded-lg border bg-muted/10 p-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <FieldWrapper
                                    label="Vehicle type"
                                    required
                                    error={errors.vehicleTypeId?.message}
                                >
                                    <Controller
                                        control={control}
                                        name="vehicleTypeId"
                                        render={({ field }) => (
                                            <Combobox
                                                options={toOptions(
                                                    (vehicleTypes.data ?? []).map((v) => ({
                                                        id: v.id,
                                                        name: v.name,
                                                    }))
                                                )}
                                                value={field.value ?? undefined}
                                                onChange={field.onChange}
                                                placeholder="Select vehicle type"
                                                disabled={softOnly}
                                                invalid={Boolean(errors.vehicleTypeId)}
                                            />
                                        )}
                                    />
                                </FieldWrapper>

                                <FieldWrapper
                                    label="Truck quantity"
                                    required
                                    error={errors.truckQuantity?.message}
                                >
                                    <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
                                        <Controller
                                            control={control}
                                            name="truckQuantity"
                                            render={({ field }) => (
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    placeholder="1"
                                                    disabled={softOnly}
                                                    value={field.value ?? ""}
                                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                                    className="border-0 shadow-none focus-visible:ring-0"
                                                />
                                            )}
                                        />
                                        <span className="border-l px-3 py-2 text-sm text-muted-foreground">
                                            trucks
                                        </span>
                                    </div>
                                </FieldWrapper>
                            </div>
                        </div>
                    )}

                    {/* Item lines */}
                    {orderType === "Item" && (
                        <div className="sm:col-span-2 space-y-2">
                            <div className="overflow-x-auto rounded-lg border">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="bg-muted/40">
                                            <th className="min-w-[200px] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                Goods
                                            </th>
                                            <th className="w-24 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                Qty
                                            </th>
                                            <th className="w-32 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                Unit
                                            </th>
                                            <th className="w-32 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                Weight
                                            </th>
                                            <th className="w-10" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {fields.length === 0 && (
                                            <tr>
                                                <td
                                                    colSpan={5}
                                                    className="px-3 py-6 text-center text-xs text-muted-foreground"
                                                >
                                                    No items yet — click Add item below.
                                                </td>
                                            </tr>
                                        )}
                                        {fields.map((field, index) => {
                                            const rowErr = errors.items?.[index];
                                            const isLast = index === fields.length - 1;
                                            return (
                                                <tr key={field.id} className="border-t align-top">
                                                    {/* Goods */}
                                                    <td className="px-2 py-2">
                                                        <Controller
                                                            control={control}
                                                            name={`items.${index}.goodsId`}
                                                            render={({ field: f }) => (
                                                                <Combobox
                                                                    options={toOptions(goods.data ?? [])}
                                                                    value={
                                                                        typeof f.value === "string"
                                                                            ? f.value
                                                                            : undefined
                                                                    }
                                                                    onChange={f.onChange}
                                                                    placeholder="Select goods"
                                                                    invalid={Boolean(rowErr?.goodsId)}
                                                                />
                                                            )}
                                                        />
                                                        {rowErr?.goodsId?.message && (
                                                            <p className="mt-1 text-xs text-red-600">
                                                                {rowErr.goodsId.message}
                                                            </p>
                                                        )}
                                                    </td>

                                                    {/* Quantity */}
                                                    <td className="px-2 py-2">
                                                        <Controller
                                                            control={control}
                                                            name={`items.${index}.quantity`}
                                                            render={({ field: f }) => (
                                                                <Input
                                                                    type="number"
                                                                    min={1}
                                                                    value={(f.value as number | string) ?? ""}
                                                                    onChange={(e) =>
                                                                        f.onChange(Number(e.target.value))
                                                                    }
                                                                    aria-invalid={Boolean(rowErr?.quantity)}
                                                                />
                                                            )}
                                                        />
                                                        {rowErr?.quantity?.message && (
                                                            <p className="mt-1 text-xs text-red-600">
                                                                {rowErr.quantity.message}
                                                            </p>
                                                        )}
                                                    </td>

                                                    {/* Unit */}
                                                    <td className="px-2 py-2">
                                                        <Controller
                                                            control={control}
                                                            name={`items.${index}.unit`}
                                                            render={({ field: f }) => (
                                                                <Combobox
                                                                    options={UNIT_OPTIONS}
                                                                    value={
                                                                        typeof f.value === "string"
                                                                            ? f.value
                                                                            : undefined
                                                                    }
                                                                    onChange={f.onChange}
                                                                    placeholder="Unit"
                                                                    invalid={Boolean(rowErr?.unit)}
                                                                />
                                                            )}
                                                        />
                                                        {rowErr?.unit?.message && (
                                                            <p className="mt-1 text-xs text-red-600">
                                                                {rowErr.unit.message}
                                                            </p>
                                                        )}
                                                    </td>

                                                    {/* Weight */}
                                                    <td className="px-2 py-2">
                                                        <Controller
                                                            control={control}
                                                            name={`items.${index}.weight`}
                                                            render={({ field: f }) => (
                                                                <Input
                                                                    type="number"
                                                                    min={0}
                                                                    step="0.01"
                                                                    placeholder="optional"
                                                                    value={(f.value as number | string) ?? ""}
                                                                    onChange={(e) =>
                                                                        f.onChange(
                                                                            e.target.value === ""
                                                                                ? undefined
                                                                                : Number(e.target.value)
                                                                        )
                                                                    }
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === "Enter" && isLast) {
                                                                            e.preventDefault();
                                                                            addRow();
                                                                        }
                                                                    }}
                                                                />
                                                            )}
                                                        />
                                                    </td>

                                                    {/* Remove */}
                                                    <td className="px-2 py-2">
                                                        <Button
                                                            type="button"
                                                            size="icon-sm"
                                                            variant="ghost"
                                                            className="text-muted-foreground hover:bg-red-50 hover:text-red-600"
                                                            disabled={fields.length === 1}
                                                            onClick={() => remove(index)}
                                                            aria-label="Remove item"
                                                        >
                                                            <IconTrash size={15} />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex items-center justify-between">
                                {typeof errors.items?.message === "string" ? (
                                    <p className="text-xs text-red-600">{errors.items.message}</p>
                                ) : (
                                    <span />
                                )}
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={addRow}
                                >
                                    <IconPlus size={15} className="mr-1" /> Add item
                                </Button>
                            </div>
                        </div>
                    )}
                </FormSection>

                {/* ── Contact & Notes ── */}
                <FormSection icon={<IconPhone size={16} />} title="Contact & Notes">
                    {/* Contact toggle */}
                    {!showContact ? (
                        <div className="sm:col-span-2 rounded-lg border border-dashed bg-muted/20 p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-medium">
                                        Additional contact details
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Add a pickup contact person if different from the customer.
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="default"
                                    size="sm"
                                    className="gap-1.5"
                                    onClick={() => setShowContact(true)}
                                >
                                    <IconUserPlus size={14} /> Add contact
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="sm:col-span-2 rounded-lg border bg-muted/10 p-4">
                            <div className="mb-4 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium">Contact details</p>
                                    <p className="text-xs text-muted-foreground">
                                        For pickup and delivery coordination.
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="gap-1.5 text-muted-foreground hover:text-red-600"
                                    onClick={() => {
                                        setShowContact(false);
                                        setValue("contactPersonName", "", { shouldDirty: true });
                                        setValue("contactMobile", "", { shouldDirty: true });
                                        setValue("contactEmail", "", { shouldDirty: true });
                                    }}
                                >
                                    <IconTrash size={14} /> Remove
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                {/* Contact name */}
                                <FieldWrapper
                                    label="Contact person"
                                    error={errors.contactPersonName?.message}
                                >
                                    <div className="flex items-center rounded-md border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
                                        <IconUserCircle size={15} className="shrink-0 text-muted-foreground" />
                                        <Controller
                                            control={control}
                                            name="contactPersonName"
                                            render={({ field }) => (
                                                <Input
                                                    {...field}
                                                    value={field.value ?? ""}
                                                    placeholder="Enter name"
                                                    className="border-0 shadow-none focus-visible:ring-0"
                                                />
                                            )}
                                        />
                                    </div>
                                </FieldWrapper>

                                {/* Mobile */}
                                <FieldWrapper
                                    label="Mobile number"
                                    error={errors.contactMobile?.message}
                                >
                                    <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
                                        <span className="border-r px-3 py-2 text-sm text-muted-foreground">
                                            +91
                                        </span>
                                        <Controller
                                            control={control}
                                            name="contactMobile"
                                            render={({ field }) => (
                                                <Input
                                                    {...field}
                                                    value={field.value ?? ""}
                                                    placeholder="10-digit mobile"
                                                    maxLength={10}
                                                    className="border-0 shadow-none focus-visible:ring-0"
                                                />
                                            )}
                                        />
                                    </div>
                                </FieldWrapper>

                                {/* Email */}
                                <FieldWrapper
                                    label="Email address"
                                    error={errors.contactEmail?.message}
                                >
                                    <div className="flex items-center rounded-md border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
                                        <IconMail size={15} className="shrink-0 text-muted-foreground" />
                                        <Controller
                                            control={control}
                                            name="contactEmail"
                                            render={({ field }) => (
                                                <Input
                                                    {...field}
                                                    type="email"
                                                    value={field.value ?? ""}
                                                    placeholder="example@company.com"
                                                    className="border-0 shadow-none focus-visible:ring-0"
                                                />
                                            )}
                                        />
                                    </div>
                                </FieldWrapper>
                            </div>
                        </div>
                    )}

                    {/* Special instructions */}
                    <FieldWrapper label="Special instructions" fullWidth>
                        <Controller
                            control={control}
                            name="specialInstructions"
                            render={({ field }) => (
                                <Textarea
                                    {...field}
                                    value={field.value ?? ""}
                                    rows={3}
                                    placeholder="Any pickup, delivery, billing, or handling notes"
                                />
                            )}
                        />
                    </FieldWrapper>
                </FormSection>
            </form>

            {/* ── Discard dialog ── */}
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
                                router.push(
                                    mode === "edit" && order ? `/orders/${order.id}` : "/orders"
                                )
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