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
import TextField from "../_shared/fields/TextField";
import SelectField from "../_shared/fields/SelectField";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: SpareCategory | null;
  onSubmit: (
    data: CreateSpareCategoryBody
  ) => Promise<void>;
  isSubmitting?: boolean;
};

const spareTypeOptions = [
  {
    label: "Item",
    value: "Item",
  },
  {
    label: "Service",
    value: "Service",
  },
];

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
    resolver: zodResolver(
      createSpareCategorySchema
    ),
    mode: "onChange",
    reValidateMode: "onChange",

    defaultValues: {
      name: "",
      type: "Item",
      ledgerName: "",
    },
  });

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
      title={
        row
          ? "Edit Spare Category"
          : "Add Spare Category"
      }
      form={form}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      columns={2}
    >
      <TextField<CreateSpareCategoryFormInput>
        name="name"
        label="Name"
        placeholder="Enter category name"
        required
      />

      <SelectField<CreateSpareCategoryFormInput>
        name="type"
        label="Type"
        options={spareTypeOptions}
        required
      />

      <TextField<CreateSpareCategoryFormInput>
        name="ledgerName"
        label="Ledger Name"
        placeholder="Enter ledger name"
      />
    </MasterFormDialog>
  );
}