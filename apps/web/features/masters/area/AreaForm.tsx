"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type { Area, CreateAreaBody, City } from "@skerp/types";
import { createAreaSchema } from "@skerp/validators";

import MasterFormDialog from "../_shared/MasterFormDialog";
import FormSection from "../_shared/fields/FormSection";
import TextField from "../_shared/fields/TextField";
import SelectField from "../_shared/fields/SelectField";

import { IconMapPin } from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: Area | null;
  cities: City[];
  onSubmit: (data: CreateAreaBody) => Promise<void>;
  isSubmitting?: boolean;
};

const defaultValues: CreateAreaBody = {
  name: "",
  cityId: "",
};

export default function AreaForm({
  open,
  onOpenChange,
  row,
  cities,
  onSubmit,
  isSubmitting,
}: Props) {
  const form = useForm<CreateAreaBody>({
    resolver: zodResolver(createAreaSchema),
    defaultValues,
  });

  React.useEffect(() => {
    if (!open) return;

    form.reset({
      name: row?.name ?? "",
      cityId: row?.cityId ?? "",
    });
  }, [form, open, row]);

  return (
    <MasterFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Area" : "Add Area"}
      form={form}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      columns={2}
    >
      {/* AREA INFO SECTION */}
      <FormSection
        icon={<IconMapPin size={18} />}
        title="Area Information"
        description="Basic details of the area"
      >
        <TextField<CreateAreaBody>
          name="name"
          label="Area Name"
          placeholder="e.g. Civil Lines"
          required
        />

        <SelectField<CreateAreaBody>
          name="cityId"
          label="City"
          options={cities.map((city) => ({
            label: city.name,
            value: city.id,
          }))}
          required
        />
      </FormSection>

    </MasterFormDialog>
  );
}