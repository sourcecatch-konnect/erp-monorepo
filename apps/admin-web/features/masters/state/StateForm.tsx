"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type { CreateStateBody, State } from "@skerp/types";
import { createStateSchema } from "@skerp/validators/master/state";

import MasterFormDialog from "../_shared/MasterFormDialog";
import FormSection from "../_shared/fields/FormSection";
import TextField from "../_shared/fields/TextField";


import { IconMapPin } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { stateKeys } from "./state.keys";
import { stateApi } from "./state.service";

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
const stateName = form.watch("name");

const trimmedStateName = stateName?.trim() ?? "";

const { data: stateSuggestions } = useQuery({
  queryKey: stateKeys.list({
    page: 0,
    size: 5,
    search: trimmedStateName,
  }),
  queryFn: () =>
    stateApi.list({
      page: 0,
      size: 5,
      search: trimmedStateName,
    }),
  enabled: open && trimmedStateName.length >= 2 && !row,
});
  React.useEffect(() => {
    if (!open) return;

    form.reset({
      name: row?.name ?? "",
    });
  }, [form, open, row]);
const firstStateSuggestion = stateSuggestions?.data?.[0];
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
  <div>
    <TextField<CreateStateBody>
      name="name"
      label="State Name"
      placeholder="e.g. Maharashtra"
      required
    />

    {firstStateSuggestion ? (
      <p className="mt-1 text-xs text-muted-foreground">
        Similar state found:{" "}
        <button
          type="button"
          onClick={() =>
            form.setValue("name", firstStateSuggestion.name, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
          className="font-medium text-primary hover:underline"
        >
          {firstStateSuggestion.name}
        </button>
      </p>
    ) : null}
  </div>
</FormSection>

    </MasterFormDialog>
  );
}