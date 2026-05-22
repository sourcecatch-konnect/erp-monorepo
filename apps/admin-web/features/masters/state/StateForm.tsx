"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createStateSchema } from "@skerp/validators/master/state";
import type { CreateStateBody, State } from "@skerp/types";
import MasterFormDialog from "../_shared/MasterFormDialog";
import TextField from "../_shared/fields/TextField";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: State | null;
  onSubmit: (data: CreateStateBody) => Promise<void>;
  isSubmitting?: boolean;
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
    defaultValues: {
      name: "",
    },
  });

  React.useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      name: row?.name ?? "",
    });
  }, [form, open, row]);

  return (
    <MasterFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit State" : "Add State"}
      form={form}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
    >
      <TextField<CreateStateBody>
        name="name"
        label="State Name"
        placeholder="Enter state name"
        required
      />
    </MasterFormDialog>
  );
}
