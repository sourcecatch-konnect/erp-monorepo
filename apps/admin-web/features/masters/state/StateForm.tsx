"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type { CreateStateBody, State } from "@skerp/types";
import { createStateSchema } from "@skerp/validators/master/state";

import MasterFormDialog from "../_shared/MasterFormDialog";
import FormSection from "../_shared/fields/FormSection";
import TextField from "../_shared/fields/TextField";
import IconTextField from "../_shared/fields/IconTextField";

import { IconMapPin } from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: State | null;
  onSubmit: (data: CreateStateBody) => Promise<void>;
  isSubmitting?: boolean;
};

const defaultValues: CreateStateBody = {
  name: "",
};

export default function StateForm({
  open,
  onOpenChange,
  row,
  onSubmit,
  isSubmitting,
}: Props) {
  const form = useForm<CreateStateBody>({
    resolver: zodResolver(createStateSchema),
    defaultValues,
  });

  React.useEffect(() => {
    if (!open) return;

    form.reset({
      name: row?.name ?? "",
    });
  }, [open, row]);

  return (
    <MasterFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit State" : "Add State"}
      form={form}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      columns={2}
    >
      {/* BASIC INFO SECTION (like DriverForm style) */}
      <FormSection
        icon={<IconMapPin size={18} />}
        title="State Information"
        description="Basic details of the state"
      >
        <TextField<CreateStateBody>
          name="name"
          label="State Name"
          placeholder="e.g. Maharashtra"
          required
        />
      </FormSection>


    </MasterFormDialog>
  );
}