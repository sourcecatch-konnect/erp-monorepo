"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type {
  CreateWagonBody,
  CreateWagonFormInput,
  Wagon,
} from "@skerp/types";

import { createWagonSchema } from "@skerp/validators";

import MasterFormDialog from "../_shared/MasterFormDialog";
import FormSection from "../_shared/fields/FormSection";
import IconTextField from "../_shared/fields/IconTextField";

import {
  IconTrain,
  IconRulerMeasure,
  IconScale,
} from "@tabler/icons-react";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";
import { wagonApi } from "./wagon.service";
import { wagonKeys } from "./wagon.key";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: Wagon | null;

};

const defaultValues: CreateWagonFormInput = {
  name: "",
  height: "",
  width: "",
  weight: "",
};

export default function WagonForm({
  open,
  onOpenChange,
  row,

}: Props) {
  const form = useForm<CreateWagonFormInput, unknown, CreateWagonBody>({
    resolver: zodResolver(createWagonSchema),
    defaultValues,
  });
const { create, update } = useMasterMutations({
  api: wagonApi,
  queryKey: wagonKeys.all,
  entityName: "Wagon",
});

const handleSubmit = async (data: CreateWagonBody) => {
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
      height: row?.height != null ? String(row.height) : "",
      width: row?.width != null ? String(row.width) : "",
      weight: row?.weight != null ? String(row.weight) : "",
    });
  }, [form, open, row]);

  return (
    <MasterFormDialog<CreateWagonFormInput, CreateWagonBody>
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Wagon" : "Add Wagon"}
      form={form}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      columns={2}
    >
      <FormSection
        icon={<IconTrain size={18} />}
        title="Wagon Information"
        description="Basic wagon identification details"
      >
        <IconTextField<CreateWagonFormInput>
          name="name"
          label="Wagon Name"
          placeholder="e.g. BOXN Wagon"
          icon={<IconTrain size={16} />}
          required
        />
      </FormSection>

      <FormSection
        icon={<IconRulerMeasure size={18} />}
        title="Wagon Dimensions"
        description="Height and width details of the wagon"
      >
<IconTextField<CreateWagonFormInput>
  name="height"
  label="Height"
  placeholder="Enter height"
  icon={<IconRulerMeasure size={16} />}
  type="number"
  suffix="m"
  required
/>

<IconTextField<CreateWagonFormInput>
  name="width"
  label="Width"
  placeholder="Enter width"
  icon={<IconRulerMeasure size={16} />}
  type="number"
  suffix="m"
  required
/>

      </FormSection>

      <FormSection
        icon={<IconScale size={18} />}
        title="Weight Details"
        description="Wagon weight capacity or actual weight"
      >
<IconTextField<CreateWagonFormInput>
  name="weight"
  label="Weight"
  placeholder="Enter weight"
  icon={<IconScale size={16} />}
  type="number"
  suffix="kg"
  required
/>
      </FormSection>
    </MasterFormDialog>
  );
}