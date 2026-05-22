"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createCitySchema } from "@skerp/validators/master/city";
import type { City, CreateCityBody, State } from "@skerp/types";
import MasterFormDialog from "../_shared/MasterFormDialog";
import SelectField from "../_shared/fields/SelectField";
import TextField from "../_shared/fields/TextField";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: City | null;
  states: State[];
  onSubmit: (data: CreateCityBody) => Promise<void>;
  isSubmitting?: boolean;
};

export default function CityForm({
  open,
  onOpenChange,
  row,
  states,
  onSubmit,
  isSubmitting,
}: Props) {
  const form = useForm<CreateCityBody>({
    resolver: zodResolver(createCitySchema),
    defaultValues: {
      name: "",
      stateId: "",
    },
  });

  React.useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      name: row?.name ?? "",
      stateId: row?.stateId ?? "",
    });
  }, [form, open, row]);

  return (
    <MasterFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit City" : "Add City"}
      form={form}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
    >
      <TextField<CreateCityBody>
        name="name"
        label="City Name"
        placeholder="Enter city name"
        required
      />
      <SelectField<CreateCityBody>
        name="stateId"
        label="State"
        options={states.map((state) => ({
          label: state.name,
          value: state.id,
        }))}
        required
      />
    </MasterFormDialog>
  );
}
