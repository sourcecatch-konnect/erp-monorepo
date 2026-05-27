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

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: SpareCategory | null;
  onSubmit: (data: CreateSpareCategoryBody) => Promise<void>;
  isSubmitting?: boolean;
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
  onSubmit,
  isSubmitting,
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

  React.useEffect(() => {
    if (!open) return;

    form.reset({
      name: row?.name ?? "",
      type: row?.type ?? "Item",
      ledgerName: row?.ledgerName ?? "",
    });
  }, [open, row]);

  return (
    <MasterFormDialog<
      CreateSpareCategoryFormInput,
      CreateSpareCategoryBody
    >
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Spare Category" : "Add Spare Category"}
      form={form}
      onSubmit={onSubmit}
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