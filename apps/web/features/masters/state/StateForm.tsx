"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type { CreateStateBody, State } from "@skerp/types";
import { createStateSchema } from "@skerp/validators/master/state";

import MasterFormDialog from "../_shared/MasterFormDialog";
import FormSection from "../_shared/fields/FormSection";
import TextField from "../_shared/fields/TextField";
import {
  Alert,
 
  AlertDescription,
  AlertTitle,

} from "@skerp/ui/components/alert"

import { IconInfoCircle, IconMapPin } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { stateKeys } from "./state.keys";
import { stateApi } from "./state.service";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: State | null;

};

const defaultValues: CreateStateBody = {
  name: "",
};

export default function StateForm({
  open,
  onOpenChange,
  row,

}: Props) {
  const form = useForm<CreateStateBody>({
    resolver: zodResolver(createStateSchema),
    defaultValues,
  });
const stateName = form.watch("name");

const trimmedStateName = stateName?.trim() ?? "";


const { create, update } = useMasterMutations({
  api: stateApi,
  queryKey: stateKeys.all,
  entityName: "State",
});

const handleSubmit = async (data: CreateStateBody) => {
  if (row) {
    await update.mutateAsync({ id: row.id, data });
  } else {
    await create.mutateAsync(data);
  }

  onOpenChange(false);
};
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
const exactStateMatch = stateSuggestions?.data?.find(
  (state) =>
    state.name.trim().toLowerCase() === trimmedStateName.toLowerCase()
);

const showStateAlreadyExistsAlert = Boolean(exactStateMatch && !row);
  return (
    <MasterFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit State" : "Add State"}
      form={form}
      onSubmit={handleSubmit}
isSubmitting={create.isPending || update.isPending}
      columns={2}
    >
      {/* BASIC INFO SECTION (like DriverForm style) */}
   <FormSection
  icon={<IconMapPin size={18} />}
  title="State Information"
  description="Basic details of the state"
>
  <div className="col-span-full grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
    <div className="relative min-w-0">
      <TextField<CreateStateBody>
        name="name"
        label="State Name"
        placeholder="e.g. Maharashtra"
        required
      />

      {firstStateSuggestion && !showStateAlreadyExistsAlert && (
        <div className="absolute right-0 top-0 flex items-center gap-1 text-xs text-muted-foreground">
          <IconInfoCircle size={14} />
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
        </div>
      )}
    </div>

    {showStateAlreadyExistsAlert ? (
      <Alert className="mt-6 w-full border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
        <IconInfoCircle className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-xs font-semibold">
          State already exists
        </AlertTitle>
        <AlertDescription className="text-xs text-amber-800">
          {exactStateMatch?.name} is already added. Please edit the existing
          record.
        </AlertDescription>
      </Alert>
    ) : (
      <div className="hidden md:block" />
    )}
  </div>
</FormSection>

    </MasterFormDialog>
  );
}