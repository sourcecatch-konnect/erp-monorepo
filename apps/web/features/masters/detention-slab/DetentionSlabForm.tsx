"use client";

import * as React from "react";
import { Controller, get, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import type {
  CreateDetentionSlabBody,
  CreateDetentionSlabFormInput,
  DetentionSlab,
} from "@skerp/types";
import { createDetentionSlabSchema } from "@skerp/validators";
import { Button } from "@skerp/ui/components/button";
import { DatePicker } from "@skerp/ui/components/datepicker";
import {
  IconCalendar,
  IconClock,
  IconCurrencyRupee,
  IconFilter,
  IconPlus,
  IconTag,
  IconTrash,
} from "@tabler/icons-react";
import { paiseToRupees } from "@/lib/money";

import MasterFormDialog from "../_shared/MasterFormDialog";
import FormSection from "../_shared/fields/FormSection";
import ComboboxField from "../_shared/fields/ComboboxField";
import IconTextField from "../_shared/fields/IconTextField";
import SelectField from "../_shared/fields/SelectField";
import SwitchField from "../_shared/fields/SwitchField";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";
import { transportApi } from "../transport/transport.service";
import { transportKeys } from "../transport/transport.key";
import { customerApi } from "../Customer/customer.service";
import { customerKeys } from "../Customer/customer.key";
import { vehicleTypeApi } from "../vehicleType/vehicleType.service";
import { vehicleTypeKeys } from "../vehicleType/vehicleType.key";
import { detentionSlabApi } from "./detention-slab.service";
import { detentionSlabKeys } from "./detention-slab.keys";

type FormValues = CreateDetentionSlabFormInput;

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: DetentionSlab | null;
};

const LOOKUP_QUERY = { size: 1000, sort: "name:asc" } as const;
const ANY = { label: "Any", value: "" };

const basisOptions = [
  { label: "Day-wise", value: "DAY" },
  { label: "Hour-wise (e.g. 407)", value: "HOUR" },
];

const rupees = (paise: number | null | undefined) =>
  paise == null ? "" : String(paiseToRupees(paise));

const emptyValues = (): FormValues => ({
  name: "",
  transportId: "",
  customerId: "",
  vehicleTypeId: "",
  freightFromPaise: "",
  freightToPaise: "",
  basis: "DAY",
  firstDayFree: true,
  lastDayFree: true,
  freeHours: "",
  blockHours: "",
  priority: 0,
  effectiveFrom: new Date(),
  effectiveTo: null,
  isActive: true,
  bands: [{ fromUnit: 1, toUnit: "", ratePaise: "" }],
});

const valuesFromRow = (row: DetentionSlab): FormValues => ({
  name: row.name,
  transportId: row.transportId ?? "",
  customerId: row.customerId ?? "",
  vehicleTypeId: row.vehicleTypeId ?? "",
  freightFromPaise: rupees(row.freightFromPaise),
  freightToPaise: rupees(row.freightToPaise),
  basis: row.basis,
  firstDayFree: row.firstDayFree,
  lastDayFree: row.lastDayFree,
  freeHours: row.freeHours ?? "",
  blockHours: row.blockHours ?? "",
  priority: row.priority,
  effectiveFrom: new Date(row.effectiveFrom),
  effectiveTo: row.effectiveTo ? new Date(row.effectiveTo) : null,
  isActive: row.isActive,
  bands: row.bands.map((band) => ({
    fromUnit: band.fromUnit,
    toUnit: band.toUnit ?? "",
    ratePaise: rupees(band.ratePaise),
  })),
});

/**
 * A broker's detention rule: who it applies to, which days or hours are free,
 * and the stacked rate bands. Blank scopes mean "any", so one house slab can
 * cover everyone and a broker-specific one overrides it.
 */
export default function DetentionSlabForm({ open, onOpenChange, row }: Props) {
  const form = useForm<FormValues, unknown, CreateDetentionSlabBody>({
    resolver: zodResolver(createDetentionSlabSchema),
    mode: "onChange",
    defaultValues: emptyValues(),
  });
  const bands = useFieldArray({ control: form.control, name: "bands" });

  const { create, update } = useMasterMutations({
    api: detentionSlabApi,
    queryKey: detentionSlabKeys.all,
    entityName: "Detention slab",
  });

  const transports = useQuery({
    queryKey: transportKeys.list(LOOKUP_QUERY),
    queryFn: () => transportApi.list(LOOKUP_QUERY),
    enabled: open,
  });
  const vehicleTypes = useQuery({
    queryKey: vehicleTypeKeys.list(LOOKUP_QUERY),
    queryFn: () => vehicleTypeApi.list(LOOKUP_QUERY),
    enabled: open,
  });
  const customers = useQuery({
    queryKey: customerKeys.list(LOOKUP_QUERY),
    queryFn: () => customerApi.list(LOOKUP_QUERY),
    enabled: open,
  });

  const toOptions = (rows?: { id: string; name: string }[]) => [
    ANY,
    ...(rows ?? []).map((r) => ({ label: r.name, value: r.id })),
  ];

  React.useEffect(() => {
    if (!open) return;
    form.reset(row ? valuesFromRow(row) : emptyValues());
  }, [form, open, row]);

  // The two bases read different fields; clear the ones that no longer apply
  // so a switch never leaves the form failing on a hidden value.
  const basis = form.watch("basis");
  React.useEffect(() => {
    if (basis === "HOUR") {
      form.setValue("firstDayFree", false);
      form.setValue("lastDayFree", false);
    } else {
      form.setValue("freeHours", "");
      form.setValue("blockHours", "");
    }
  }, [basis, form]);

  const unit = basis === "HOUR" ? "block" : "day";
  const bandsError = get(form.formState.errors, "bands")?.message;

  const addBand = () => {
    const last = form.getValues(`bands.${bands.fields.length - 1}`);
    const lastEnd = Number(last?.toUnit);
    // Continue where the last band ends; if it was open-ended, start just
    // after its start and let the operator close it.
    bands.append({
      fromUnit:
        Number.isInteger(lastEnd) && lastEnd > 0
          ? lastEnd + 1
          : Number(last?.fromUnit ?? 0) + 1,
      toUnit: "",
      ratePaise: "",
    });
  };

  const handleSubmit = async (data: CreateDetentionSlabBody) => {
    if (row) {
      await update.mutateAsync({ id: row.id, data });
    } else {
      await create.mutateAsync(data);
    }
    onOpenChange(false);
  };

  return (
    <MasterFormDialog<FormValues, CreateDetentionSlabBody>
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Detention Slab" : "Add Detention Slab"}
      form={form}
      onSubmit={handleSubmit}
      isSubmitting={create.isPending || update.isPending}
      columns={2}
    >
      <FormSection
        icon={<IconTag size={18} />}
        title="Slab"
        description="Name, priority and the dates it is valid"
        columns={2}
      >
        <IconTextField<FormValues>
          name="name"
          label="Name"
          placeholder="e.g. Bipin Singh – 32HQ"
          icon={<IconTag size={16} />}
          required
        />
        <IconTextField<FormValues>
          name="priority"
          label="Priority"
          type="number"
          min={0}
          hint="When two slabs match equally, the higher priority wins"
        />
        <Controller
          control={form.control}
          name="effectiveFrom"
          render={({ field, fieldState }) => (
            <div>
              <DatePicker
                label="Effective from *"
                selected={field.value ? new Date(field.value) : undefined}
                onSelect={(date) => field.onChange(date ?? "")}
                clearable={false}
              />
              {fieldState.error?.message ? (
                <p className="mt-1 text-xs text-destructive">
                  {fieldState.error.message}
                </p>
              ) : null}
            </div>
          )}
        />
        <Controller
          control={form.control}
          name="effectiveTo"
          render={({ field, fieldState }) => (
            <div>
              <DatePicker
                label="Effective to"
                placeholder="Open-ended"
                selected={field.value ? new Date(field.value) : undefined}
                onSelect={(date) => field.onChange(date ?? null)}
              />
              {fieldState.error?.message ? (
                <p className="mt-1 text-xs text-destructive">
                  {fieldState.error.message}
                </p>
              ) : null}
            </div>
          )}
        />
        <SwitchField<FormValues>
          name="isActive"
          label="Active"
          description="Inactive slabs are never used to calculate detention"
        />
      </FormSection>

      <FormSection
        icon={<IconFilter size={18} />}
        title="Applies to"
        description="Leave a field on Any to match everyone. The most specific slab wins."
        columns={2}
      >
        <ComboboxField<FormValues>
          name="transportId"
          label="Broker / transporter"
          options={toOptions(transports.data?.data)}
        />
        <ComboboxField<FormValues>
          name="vehicleTypeId"
          label="Vehicle type"
          options={toOptions(vehicleTypes.data?.data)}
        />
        <ComboboxField<FormValues>
          name="customerId"
          label="Customer"
          options={toOptions(customers.data?.data)}
        />
        <div className="grid grid-cols-2 gap-3">
          <IconTextField<FormValues>
            name="freightFromPaise"
            label="Freight from"
            type="number"
            min={0}
            step="0.01"
            icon={<IconCurrencyRupee size={16} />}
          />
          <IconTextField<FormValues>
            name="freightToPaise"
            label="Freight to"
            type="number"
            min={0}
            step="0.01"
            icon={<IconCurrencyRupee size={16} />}
          />
        </div>
      </FormSection>

      <FormSection
        icon={<IconClock size={18} />}
        title="Free time"
        description={
          basis === "HOUR"
            ? "Hours are counted from reporting to unloading, then billed in blocks"
            : "Days are counted from the final reporting date to the final unloading date"
        }
        columns={2}
      >
        <SelectField<FormValues>
          name="basis"
          label="Count detention by"
          options={basisOptions}
          icon={<IconCalendar size={16} />}
          required
        />
        {basis === "HOUR" ? (
          <div className="grid grid-cols-2 gap-3">
            <IconTextField<FormValues>
              name="freeHours"
              label="Free hours"
              type="number"
              min={0}
              placeholder="e.g. 24"
              suffix="h"
            />
            <IconTextField<FormValues>
              name="blockHours"
              label="Bill per block of"
              type="number"
              min={1}
              placeholder="e.g. 24"
              suffix="h"
              required
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <SwitchField<FormValues>
              name="firstDayFree"
              label="First day free"
            />
            <SwitchField<FormValues> name="lastDayFree" label="Last day free" />
          </div>
        )}
      </FormSection>

      <FormSection
        icon={<IconCurrencyRupee size={18} />}
        title="Rate bands"
        description={`Rates stack per chargeable ${unit}, after free time. Leave "To" empty on the last band for "and above".`}
        columns={1}
      >
        <div className="space-y-2">
          {bands.fields.map((band, index) => (
            <div
              key={band.id}
              className="grid grid-cols-[1fr_1fr_1.4fr_auto] items-end gap-2"
            >
              <IconTextField<FormValues>
                name={`bands.${index}.fromUnit`}
                label={`From ${unit}`}
                type="number"
                min={1}
                required
              />
              <IconTextField<FormValues>
                name={`bands.${index}.toUnit`}
                label={`To ${unit}`}
                type="number"
                min={1}
                placeholder="and above"
              />
              <IconTextField<FormValues>
                name={`bands.${index}.ratePaise`}
                label={`Rate per ${unit}`}
                type="number"
                min={0}
                step="0.01"
                icon={<IconCurrencyRupee size={16} />}
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove band ${index + 1}`}
                disabled={bands.fields.length === 1}
                onClick={() => bands.remove(index)}
              >
                <IconTrash size={16} />
              </Button>
            </div>
          ))}
          {typeof bandsError === "string" ? (
            <p className="text-xs text-destructive">{bandsError}</p>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={addBand}>
            <IconPlus size={14} className="mr-1" /> Add band
          </Button>
        </div>
      </FormSection>
    </MasterFormDialog>
  );
}
