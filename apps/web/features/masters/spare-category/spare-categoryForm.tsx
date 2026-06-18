"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type {
  SpareCategory,
  CreateSpareCategoryBody,
  CreateSpareCategoryFormInput,
} from "@skerp/types";

import { createSpareCategorySchema } from "@skerp/validators";

import MasterFormDialog from "../_shared/MasterFormDialog";
import FormSection from "../_shared/fields/FormSection";
import TextField from "../_shared/fields/TextField";
import SelectField from "../_shared/fields/SelectField";

import { IconTool } from "@tabler/icons-react";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";
import { spareCategoryApi } from "./spare-cateogry.service";
import { spareCategoryKeys } from "./spare-category.key";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: SpareCategory | null;
};

const spareTypeOptions = [
  { label: "Item", value: "Item" },
  { label: "Service", value: "Service" },
];

const defaultValues: CreateSpareCategoryFormInput = {
  name: "",
  type: "Item",
  ledgerName: "",
};

export default function SpareCategoryForm({
  open,
  onOpenChange,
  row,

}: Props) {
  const form = useForm<
    CreateSpareCategoryFormInput,
    unknown,
    CreateSpareCategoryBody
  >({
    resolver: zodResolver(createSpareCategorySchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues,
  });
const { create, update } = useMasterMutations({
  api: spareCategoryApi,
  queryKey: spareCategoryKeys.all,
});

const handleSubmit = async (data: CreateSpareCategoryBody) => {
  if (row) {
    await update.mutateAsync({ id: row.id, data });
  } else {
    await create.mutateAsync(data);
  }

  onOpenChange(false);
};

const isSubmitting = create.isPending || update.isPending;
  React.useEffect(() => {
    if (!open) return;

    form.reset({
      name: row?.name ?? "",
      type: row?.type ?? "Item",
      ledgerName: row?.ledgerName ?? "",
    });
  }, [form, open, row]);

  return (
    <MasterFormDialog<
      CreateSpareCategoryFormInput,
      CreateSpareCategoryBody
    >
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Spare Category" : "Add Spare Category"}
      form={form}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      columns={2}
    >
      {/* BASIC INFO */}
      <FormSection
        icon={<IconTool size={18} />}
        title="Spare Category Information"
        description="Basic details of spare category"
      >
        <TextField<CreateSpareCategoryFormInput>
          name="name"
          label="Category Name"
          placeholder="e.g. Engine Parts"
          required
        />

        <SelectField<CreateSpareCategoryFormInput>
          name="type"
          label="Type"
          options={spareTypeOptions}
          required
        />
      </FormSection>

      {/* ACCOUNTING INFO */}
      <FormSection
        icon={<IconTool size={18} />}
        title="Accounting Details"
        description="Ledger mapping for accounting system"
      >
        <TextField<CreateSpareCategoryFormInput>
          name="ledgerName"
          label="Ledger Name"
          placeholder="e.g. Spare Parts Account"
        />
      </FormSection>
    </MasterFormDialog>
  );
}