"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type { City, CreateCityBody } from "@skerp/types";
import { createCitySchema } from "@skerp/validators/master/city";
import { useQuery } from "@tanstack/react-query";
import { cityApi } from "./city.service";
import { cityKeys } from "./city.keys";
import MasterFormDialog from "../_shared/MasterFormDialog";
import FormSection from "../_shared/fields/FormSection";
import TextField from "../_shared/fields/TextField";
import SelectField from "../_shared/fields/SelectField";

import { IconBuildingCommunity, IconInfoCircle } from "@tabler/icons-react";
import { Alert, AlertDescription, AlertTitle } from "@skerp/ui/components/alert";
import { stateApi } from "../state/state.service";
import { stateKeys } from "../state/state.keys";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: City | null;

};

const defaultValues: CreateCityBody = {
  name: "",
  stateId: "",
};

export default function CityForm({
  open,
  onOpenChange,
  row,

}: Props) {
  const form = useForm<CreateCityBody>({
    resolver: zodResolver(createCitySchema),
    defaultValues,
  });
  const { create, update } = useMasterMutations({
  api: cityApi,
  queryKey: cityKeys.all,
  entityName: "City",
});

const states = useQuery({
  queryKey: stateKeys.list({
    page: 0,
    size: 35,
    sort: "name:asc",
  }),
  queryFn: () =>
    stateApi.list({
      page: 0,
      size: 35,
      sort: "name:asc",
    }),
  enabled: open,
});

const handleSubmit = async (data: CreateCityBody) => {
  if (row) {
    await update.mutateAsync({ id: row.id, data });
  } else {
    await create.mutateAsync(data);
  }

  onOpenChange(false);
};
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
const exactCityMatch = filteredCitySuggestions.find(
  (city) =>
    city.name.trim().toLowerCase() ===
    trimmedCityName.toLowerCase()
);

const showCityAlreadyExistsAlert =
  Boolean(exactCityMatch && !row);
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
  onSubmit={handleSubmit}
  isSubmitting={create.isPending || update.isPending}
  columns={2}
>
      {/* CITY INFO SECTION */}
     <FormSection
  icon={<IconBuildingCommunity size={18} />}
  title="City Information"
  description="Basic details of the city"
>

<SelectField<CreateCityBody>
  name="stateId"
  label="State"
  options={(states.data?.data ?? []).map((state) => ({
    label: state.name,
    value: state.id,
  }))}
  required
/>
  <TextField<CreateCityBody>
    name="name"
    label="City Name"
    placeholder="e.g. Nagpur"
    required
  />

  {showCityAlreadyExistsAlert && (
    <div className="col-span-full">
      <Alert className="border-amber-200 bg-amber-50">
        <IconInfoCircle className="h-4 w-4 text-amber-600" />
        <AlertTitle>
          City already exists
        </AlertTitle>
        <AlertDescription>
          <strong>{exactCityMatch?.name}</strong> is already
          available in the selected state.
        </AlertDescription>
      </Alert>
    </div>
  )}
</FormSection>
    </MasterFormDialog>
  );
}
