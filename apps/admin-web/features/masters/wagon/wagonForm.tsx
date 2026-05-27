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

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: Wagon | null;
  onSubmit: (data: CreateWagonBody) => Promise<void>;
  isSubmitting?: boolean;
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
  onSubmit,
  isSubmitting,
}: Props) {
  const form = useForm<CreateWagonFormInput, unknown, CreateWagonBody>({
    resolver: zodResolver(createWagonSchema),
    defaultValues,
  });

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
      onSubmit={onSubmit}
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
  label="Height (Meter)"
  placeholder="Enter height in meter"
  icon={<IconRulerMeasure size={16} />}
  type="number"
  required
/>

<IconTextField<CreateWagonFormInput>
  name="width"
  label="Width (Meter)"
  placeholder="Enter width in meter"
  icon={<IconRulerMeasure size={16} />}
  type="number"
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
  label="Weight (Kg)"
  placeholder="Enter weight in kg"
  icon={<IconScale size={16} />}
  type="number"
  required
/>
      </FormSection>
    </MasterFormDialog>
  );
}