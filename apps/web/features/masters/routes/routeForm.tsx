"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type {
  Route,
  City,
  CreateRouteBody,
  CreateRouteFormInput,
} from "@skerp/types";

import { createRouteSchema } from "@skerp/validators";

import MasterFormDialog from "../_shared/MasterFormDialog";
import SelectField from "../_shared/fields/SelectField";
import { useQuery } from "@tanstack/react-query";

import { useMasterMutations } from "../_shared/hooks/useMasterMutation";
import { routeApi } from "./routes.service";
import { routeKeys } from "./route.key";
import CitySelectField from "../_shared/fields/CitySelectField";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: Route | null;
};

export default function RouteForm({
  open,
  onOpenChange,
  row,
 
}: Props) {
  const form = useForm<
    CreateRouteFormInput,
    unknown,
    CreateRouteBody
  >({
    resolver: zodResolver(createRouteSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      sourceCityId: "",
      destinationCityId: "",
    },
  });


const { create, update } = useMasterMutations({
  api: routeApi,
  queryKey: routeKeys.all,
});

const handleSubmit = async (data: CreateRouteBody) => {
  if (row) {
    await update.mutateAsync({ id: row.id, data });
  } else {
    await create.mutateAsync(data);
  }

  onOpenChange(false);
};

const isSubmitting = create.isPending || update.isPending;
  React.useEffect(() => {
    if (!open) return;

    form.reset({
      sourceCityId: row?.sourceCityId ?? "",
      destinationCityId: row?.destinationCityId ?? "",
    });
  }, [form, open, row]);


  return (
    <MasterFormDialog<CreateRouteFormInput, CreateRouteBody>
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Route" : "Add Route"}
      form={form}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      columns={2}
    >
  <CitySelectField<CreateRouteFormInput>
  name="sourceCityId"
  label="From City"
  required
  initialCity={
    row?.sourceCity
      ? {
          id: row.sourceCity.id,
          name: row.sourceCity.name,
        }
      : null
  }
/>

<CitySelectField<CreateRouteFormInput>
  name="destinationCityId"
  label="To City"
  required
  initialCity={
    row?.destinationCity
      ? {
          id: row.destinationCity.id,
          name: row.destinationCity.name,
        }
      : null
  }
/>
    </MasterFormDialog>
  );
}