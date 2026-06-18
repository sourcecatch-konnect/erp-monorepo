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
import { paiseToRupees } from "@/lib/money";

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
  IconCurrencyRupee,
} from "@tabler/icons-react";
import IconTextField from "../_shared/fields/IconTextField";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { spareCategoryKeys } from "../spare-category/spare-category.key";
import { spareCategoryApi } from "../spare-category/spare-cateogry.service";
import { sparePartSupplierKeys } from "../spare-partSuppiler/spare-partSupplier.key";
import { sparePartSupplierApi } from "../spare-partSuppiler/spare-partSupplier.service";
import { sparePartApi } from "./spare-parts.service";
import { sparePartKeys } from "./spare-parts.key";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: SparePart | null;
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
  rate: undefined as any,
minimumStock: undefined as any,
  unit: "",
  isRecyclable: false,
  isBatchTracked: false,
  description: "",
};

export default function SparePartForm({
  open,
  onOpenChange,
  row,

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
      rate: row?.rate != null ? paiseToRupees(row.rate) : 0,
minimumStock: row?.minimumStock ?? 0,
      unit: row?.unit ?? "",
      isRecyclable: row?.isRecyclable ?? false,
      isBatchTracked: row?.isBatchTracked ?? false,
      description: row?.description ?? "",
    });
  }, [form, open, row]);
const queryClient = useQueryClient();

const categories = useQuery({
  queryKey: spareCategoryKeys.list(),
  queryFn: () => spareCategoryApi.list(),
  enabled: open,
});

const suppliers = useQuery({
  queryKey: sparePartSupplierKeys.list(),
  queryFn: () => sparePartSupplierApi.list(),
  enabled: open,
});


const { create, update } = useMasterMutations({
  api: sparePartApi,
  queryKey: sparePartKeys.all,
});

const handleSubmit = async (data: CreateSparePartBody) => {
  if (row) {
    await update.mutateAsync({ id: row.id, data });
  } else {
    await create.mutateAsync(data);
  }

  onOpenChange(false);
};
const isSubmitting = create.isPending || update.isPending;


const categoryOptions = (categories.data?.data ?? []).map((c) => ({
  label: c.name,
  value: c.id,
}));

const supplierOptions = (suppliers.data?.data ?? []).map((s) => ({
  label: s.shopName ? `${s.name} - ${s.shopName}` : s.name,
  value: s.id,
}));

  return (
    <MasterFormDialog<CreateSparePartFormInput, CreateSparePartBody>
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Spare Part" : "Add Spare Part"}
      form={form}
      onSubmit={handleSubmit}
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
  <IconTextField<CreateSparePartFormInput>
    name="rate"
    label="Rate"
    type="number"
    placeholder="e.g. 1250"
    icon={<IconCurrencyRupee size={15} />}
    min={0}
    max={9999999}
    step="0.01"
    inputMode="decimal"
    required
  />

  <IconTextField<CreateSparePartFormInput>
    name="minimumStock"
    label="Minimum Stock"
    type="number"
    placeholder="e.g. 10"
    icon={<IconPackage size={15} />}
    min={0}
    max={999999}
    step={1}
    inputMode="numeric"
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
