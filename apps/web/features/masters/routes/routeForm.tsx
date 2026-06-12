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

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: Route | null;
  cities: City[];
  onSubmit: (data: CreateRouteBody) => Promise<void>;
  isSubmitting?: boolean;
};

export default function RouteForm({
  open,
  onOpenChange,
  row,
  cities,
  onSubmit,
  isSubmitting,
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

  React.useEffect(() => {
    if (!open) return;

    form.reset({
      sourceCityId: row?.sourceCityId ?? "",
      destinationCityId: row?.destinationCityId ?? "",
    });
  }, [form, open, row]);

  const cityOptions = cities.map((city) => ({
    label: city.name,
    value: city.id,
  }));

  return (
    <MasterFormDialog<CreateRouteFormInput, CreateRouteBody>
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Route" : "Add Route"}
      form={form}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      columns={2}
    >
      <SelectField<CreateRouteFormInput>
        name="sourceCityId"
        label="From City"
        options={cityOptions}
        required
      />

      <SelectField<CreateRouteFormInput>
        name="destinationCityId"
        label="To City"
        options={cityOptions}
        required
      />
    </MasterFormDialog>
  );
}