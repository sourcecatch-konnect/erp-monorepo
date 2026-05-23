"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";


import type {
  Area,
  CreateAreaBody,
  City,
} from "@skerp/types";

import MasterFormDialog from "../_shared/MasterFormDialog";
import SelectField from "../_shared/fields/SelectField";
import TextField from "../_shared/fields/TextField";
import { createAreaSchema } from "@skerp/validators";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: Area | null;
  cities: City[];
  onSubmit: (data: CreateAreaBody) => Promise<void>;
  isSubmitting?: boolean;
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
    defaultValues: {
      name: "",
      cityId: "",
    },
  });

  React.useEffect(() => {
    if (!open) {
      return;
    }

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
    >
      <TextField<CreateAreaBody>
        name="name"
        label="Area Name"
        placeholder="Enter area name"
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
    </MasterFormDialog>
  );
}