"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type { City, CreateCityBody, State } from "@skerp/types";
import { createCitySchema } from "@skerp/validators/master/city";
import { useQuery } from "@tanstack/react-query";
import { cityApi } from "./city.service";
import { cityKeys } from "./city.keys";
import MasterFormDialog from "../_shared/MasterFormDialog";
import FormSection from "../_shared/fields/FormSection";
import TextField from "../_shared/fields/TextField";
import SelectField from "../_shared/fields/SelectField";

import { IconBuildingCommunity } from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: City | null;
  states: State[];
  onSubmit: (data: CreateCityBody) => Promise<void>;
  isSubmitting?: boolean;
};

const defaultValues: CreateCityBody = {
  name: "",
  stateId: "",
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
    defaultValues,
  });
const cityName = form.watch("name");
const selectedStateId = form.watch("stateId");

const trimmedCityName = cityName?.trim() ?? "";
const isCreateMode = !row;

const { data: citySuggestions } = useQuery({
  queryKey: cityKeys.list({
    page: 0,
    size: 5,
    search: trimmedCityName,
  }),
  queryFn: () =>
    cityApi.list({
      page: 0,
      size: 5,
      search: trimmedCityName,
    }),
  enabled:
    open &&
    isCreateMode &&
    trimmedCityName.length >= 2 &&
    !!selectedStateId,
});

const filteredCitySuggestions = isCreateMode
  ? citySuggestions?.data?.filter(
      (city) => city.stateId === selectedStateId
    ) ?? []
  : [];

const firstCitySuggestion = filteredCitySuggestions[0];
  React.useEffect(() => {
    if (!open) return;

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
      columns={2}
    >
      {/* CITY INFO SECTION */}
     <FormSection
  icon={<IconBuildingCommunity size={18} />}
  title="City Information"
  description="Basic details of the city"
>
<div>
  <TextField<CreateCityBody>
    name="name"
    label="City Name"
    placeholder="e.g. Nagpur"
    required
  />

{!row && firstCitySuggestion ? (
  <p className="mt-1 text-xs text-muted-foreground">
    Similar city found:{" "}
    <button
      type="button"
      onClick={() => form.setValue("name", firstCitySuggestion.name)}
      className="font-medium text-primary hover:underline"
    >
      {firstCitySuggestion.name}
    </button>
  </p>
) : null}
</div>


  <SelectField<CreateCityBody>
    name="stateId"
    label="State"
    options={states.map((state) => ({
      label: state.name,
      value: state.id,
    }))}
    required
  />
</FormSection>
    </MasterFormDialog>
  );
}