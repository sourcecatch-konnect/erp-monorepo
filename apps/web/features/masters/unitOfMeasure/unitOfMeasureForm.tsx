"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type {
  CreateUnitOfMeasureBody,
  CreateUnitOfMeasureFormInput,
  UnitOfMeasure,
} from "@skerp/types";
import { createUnitOfMeasureSchema } from "@skerp/validators";
import {
  IconCategory,
  IconHash,
  IconRulerMeasure,
  IconTag,
} from "@tabler/icons-react";

import MasterFormDialog from "../_shared/MasterFormDialog";
import FormSection from "../_shared/fields/FormSection";
import IconTextField from "../_shared/fields/IconTextField";
import SelectField from "../_shared/fields/SelectField";
import SwitchField from "../_shared/fields/SwitchField";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";
import { unitOfMeasureApi } from "./unitOfMeasure.service";
import { unitOfMeasureKeys } from "./unitOfMeasure.key";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: UnitOfMeasure | null;
};

const categoryOptions = [
  { label: "Weight", value: "WEIGHT" },
  { label: "Packaging", value: "PACKAGING" },
  { label: "Count", value: "COUNT" },
  { label: "Length", value: "LENGTH" },
  { label: "Volume", value: "VOLUME" },
];

export default function UnitOfMeasureForm({
  open,
  onOpenChange,
  row,
}: Props) {
  const form = useForm<
    CreateUnitOfMeasureFormInput,
    unknown,
    CreateUnitOfMeasureBody
  >({
    resolver: zodResolver(createUnitOfMeasureSchema),
    mode: "onChange",
    defaultValues: {
      code: "",
      name: "",
      category: "WEIGHT",

      isActive: true,
    },
  });

  const { create, update } = useMasterMutations({
    api: unitOfMeasureApi,
    queryKey: unitOfMeasureKeys.all,
    entityName: "Unit of measure",
  });

  const handleSubmit = async (data: CreateUnitOfMeasureBody) => {
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
      code: row?.code ?? "",
      name: row?.name ?? "",
      category: row?.category ?? "WEIGHT",

      isActive: row?.isActive ?? true,
    });
  }, [form, open, row]);

  return (
    <MasterFormDialog<CreateUnitOfMeasureFormInput, CreateUnitOfMeasureBody>
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Unit of Measure" : "Add Unit of Measure"}
      form={form}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      columns={2}
    >
      <FormSection
        icon={<IconRulerMeasure size={18} />}
        title="Unit Details"
        description="Code, category and optional conversion to a base unit"
      >
        <IconTextField<CreateUnitOfMeasureFormInput>
          name="code"
          label="Code"
          placeholder="e.g. KG"
          icon={<IconHash size={16} />}
          onChangeTransform={(value) => value.toUpperCase()}
          required
        />

        <IconTextField<CreateUnitOfMeasureFormInput>
          name="name"
          label="Name"
          placeholder="e.g. Kilogram"
          icon={<IconTag size={16} />}
          required
        />

        <SelectField<CreateUnitOfMeasureFormInput>
          name="category"
          label="Category"
          placeholder="Select category"
          options={categoryOptions}
          icon={<IconCategory size={16} />}
          required
        />

     

        <SwitchField<CreateUnitOfMeasureFormInput>
          name="isActive"
          label="Active"
          description="Available for selection in forms"
        />
      </FormSection>
    </MasterFormDialog>
  );
}
