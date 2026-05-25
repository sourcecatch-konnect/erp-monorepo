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
import TextField from "../_shared/fields/TextField";
import SelectField from "../_shared/fields/SelectField";
import NumberField from "../_shared/fields/NumberField";
import CheckboxField from "../_shared/fields/CheckBoxField";

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
    defaultValues: {
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
    },
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
  }, [form, open, row]);

  const categoryOptions = categories.map((category) => ({
    label: category.name,
    value: category.id,
  }));

  const supplierOptions = suppliers.map((supplier) => ({
    label: supplier.shopName
      ? `${supplier.name} - ${supplier.shopName}`
      : supplier.name,
    value: supplier.id,
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
      <TextField<CreateSparePartFormInput>
        name="name"
        label="Name"
        placeholder="Enter spare part name"
        required
      />

      <SelectField<CreateSparePartFormInput>
        name="type"
        label="Type"
        options={partTypeOptions}
        required
      />

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

      <NumberField<CreateSparePartFormInput>
        control={form.control}
        name="rate"
        label="Rate"
        placeholder="Enter rate"
        min={0}
        max={9999999}
        step="0.01"
        required
      />

      <NumberField<CreateSparePartFormInput>
        control={form.control}
        name="minimumStock"
        label="Minimum Stock"
        placeholder="Enter minimum stock"
        min={0}
        max={999999}
        required
      />

      <TextField<CreateSparePartFormInput>
        name="unit"
        label="Unit"
        placeholder="PCS / KG / LTR"
        required
      />

      <CheckboxField<CreateSparePartFormInput>
        name="isRecyclable"
        label="Is Recyclable"
      />

      <CheckboxField<CreateSparePartFormInput>
        name="isBatchTracked"
        label="Is Batch Tracked"
      />

      <TextField<CreateSparePartFormInput>
        name="description"
        label="Description"
        placeholder="Enter description"
      />
    </MasterFormDialog>
  );
}