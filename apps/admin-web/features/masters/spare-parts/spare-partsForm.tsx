"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type {
  SparePart,
  SpareCategory,
  SparePartSupplier,
  CreateSparePartBody,
  CreateSparePartFormInput,
} from "@skerp/types";

import { createSparePartSchema } from "@skerp/validators";

import MasterFormDialog from "../_shared/MasterFormDialog";
import FormSection from "../_shared/fields/FormSection";
import TextField from "../_shared/fields/TextField";
import SelectField from "../_shared/fields/SelectField";
import NumberField from "../_shared/fields/NumberField";
import CheckboxField from "../_shared/fields/CheckBoxField";

import {
  IconTool,
  IconPackage,
  IconTruck,
} from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: SparePart | null;
  categories: SpareCategory[];
  suppliers: SparePartSupplier[];
  onSubmit: (data: CreateSparePartBody) => Promise<void>;
  isSubmitting?: boolean;
};

const partTypeOptions = [
  { label: "Item", value: "Item" },
  { label: "Service", value: "Service" },
];

const defaultValues: CreateSparePartFormInput = {
  name: "",
  type: "Item",
  categoryId: "",
  supplierId: "",
  rate: "",
  minimumStock: "",
  unit: "",
  isRecyclable: false,
  isBatchTracked: false,
  description: "",
};

export default function SparePartForm({
  open,
  onOpenChange,
  row,
  categories,
  suppliers,
  onSubmit,
  isSubmitting,
}: Props) {
  const form = useForm<
    CreateSparePartFormInput,
    unknown,
    CreateSparePartBody
  >({
    resolver: zodResolver(createSparePartSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues,
  });

  React.useEffect(() => {
    if (!open) return;

    form.reset({
      name: row?.name ?? "",
      type: row?.type ?? "Item",
      categoryId: row?.categoryId ?? "",
      supplierId: row?.supplierId ?? "",
      rate: row?.rate != null ? String(row.rate) : "",
      minimumStock:
        row?.minimumStock != null ? String(row.minimumStock) : "",
      unit: row?.unit ?? "",
      isRecyclable: row?.isRecyclable ?? false,
      isBatchTracked: row?.isBatchTracked ?? false,
      description: row?.description ?? "",
    });
  }, [open, row]);

  const categoryOptions = categories.map((c) => ({
    label: c.name,
    value: c.id,
  }));

  const supplierOptions = suppliers.map((s) => ({
    label: s.shopName ? `${s.name} - ${s.shopName}` : s.name,
    value: s.id,
  }));

  return (
    <MasterFormDialog<CreateSparePartFormInput, CreateSparePartBody>
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Spare Part" : "Add Spare Part"}
      form={form}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      columns={3}
    >
      {/* BASIC INFO */}
      <FormSection
        icon={<IconPackage size={18} />}
        title="Spare Part Information"
        description="Basic details of the spare part"
      >
        <TextField<CreateSparePartFormInput>
          name="name"
          label="Part Name"
          placeholder="e.g. Brake Pad"
          required
        />

        <SelectField<CreateSparePartFormInput>
          name="type"
          label="Type"
          options={partTypeOptions}
          required
        />

        <TextField<CreateSparePartFormInput>
          name="unit"
          label="Unit"
          placeholder="PCS / KG / LTR"
          required
        />
      </FormSection>

      {/* CLASSIFICATION */}
      <FormSection
        icon={<IconTool size={18} />}
        title="Classification"
        description="Category and supplier mapping"
      >
        <SelectField<CreateSparePartFormInput>
          name="categoryId"
          label="Category"
          options={categoryOptions}
          required
        />

        <SelectField<CreateSparePartFormInput>
          name="supplierId"
          label="Supplier"
          options={supplierOptions}
          required
        />
      </FormSection>

      {/* PRICING & STOCK */}
      <FormSection
        icon={<IconTruck size={18} />}
        title="Stock & Pricing"
        description="Inventory and pricing details"
      >
        <NumberField<CreateSparePartFormInput>
          control={form.control}
          name="rate"
          label="Rate"
          min={0}
          max={9999999}
          step="0.01"
          required
        />

        <NumberField<CreateSparePartFormInput>
          control={form.control}
          name="minimumStock"
          label="Minimum Stock"
          min={0}
          max={999999}
          required
        />
      </FormSection>

      {/* OPTIONS */}
      <FormSection
        icon={<IconTool size={18} />}
        title="Properties"
        description="Special tracking options"
      >
        <CheckboxField<CreateSparePartFormInput>
          name="isRecyclable"
          label="Is Recyclable"
        />

        <CheckboxField<CreateSparePartFormInput>
          name="isBatchTracked"
          label="Is Batch Tracked"
        />
      </FormSection>

      {/* DESCRIPTION */}
      <FormSection
        icon={<IconTool size={18} />}
        title="Additional Details"
      >
        <TextField<CreateSparePartFormInput>
          name="description"
          label="Description"
          placeholder="Enter description"
        />
      </FormSection>
    </MasterFormDialog>
  );
}