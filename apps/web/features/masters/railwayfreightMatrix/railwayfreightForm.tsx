"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type {
  CreateRailwayFreightMatrixBody,
  CreateRailwayFreightMatrixFormInput,
  RailwayFreightMatrix,
  RailwayFreightMatrixWithRelations,

} from "@skerp/types";

import { createRailwayFreightMatrixSchema } from "@skerp/validators";
import { paiseToRupees } from "@/lib/money";

import MasterFormDialog from "../_shared/MasterFormDialog";
import FormSection from "../_shared/fields/FormSection";
import IconTextField from "../_shared/fields/IconTextField";
import SelectField from "../_shared/fields/SelectField";

import {
  IconTrain,
  IconMapPin,
  IconCurrencyRupee,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { wagonApi } from "../wagon/wagon.service";
import { wagonKeys } from "../wagon/wagon.key";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";
import { railwayFreightApi } from "./railwayfreight.service";
import { railwayFreightKeys } from "./railwayfreight.key";
import CitySelectField from "../_shared/fields/CitySelectField";
import { areaApi } from "../area/area.service";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: RailwayFreightMatrixWithRelations | null;
};

const defaultValues: CreateRailwayFreightMatrixFormInput = {
  wagonId: "",
  sourceCityId: "",
  sourceAreaId: "",
  destinationCityId: "",
  destinationAreaId: "",
  freightAmount: "",
};
export default function RailwayFreightForm({
  open,
  onOpenChange,
  row,

}: Props) {
  const form = useForm<
    CreateRailwayFreightMatrixFormInput,
    unknown,
    CreateRailwayFreightMatrixBody
  >({
    resolver: zodResolver(createRailwayFreightMatrixSchema),
    defaultValues,
  });


const wagons = useQuery({
  queryKey: wagonKeys.list({ page: 0, size: 1000 }),
  queryFn: () => wagonApi.list({ page: 0, size: 1000 }),
  enabled: open,
});

const { create, update } = useMasterMutations({
  api: railwayFreightApi,
  queryKey: railwayFreightKeys.all,
  entityName: "Railway Freight",
});

const handleSubmit = async (data: CreateRailwayFreightMatrixBody) => {
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
  wagonId: row?.wagonId ?? "",
  sourceCityId: row?.sourceCityId ?? "",
  sourceAreaId: row?.sourceAreaId ?? "",
  destinationCityId: row?.destinationCityId ?? "",
  destinationAreaId: row?.destinationAreaId ?? "",
  freightAmount:
    row?.freightAmount != null
      ? String(paiseToRupees(row.freightAmount))
      : "",
});
  }, [open, row, form]);

const sourceCityId = form.watch("sourceCityId");
const destinationCityId = form.watch("destinationCityId");

const sourceAreas = useQuery({
  queryKey: ["railway-freight-source-areas", sourceCityId],
  queryFn: () =>
    areaApi.list({
      page: 0,
      size: 1000,
      cityId: sourceCityId,
    } as any),
  enabled: open && Boolean(sourceCityId),
});

const destinationAreas = useQuery({
  queryKey: ["railway-freight-destination-areas", destinationCityId],
  queryFn: () =>
    areaApi.list({
      page: 0,
      size: 1000,
      cityId: destinationCityId,
    } as any),
  enabled: open && Boolean(destinationCityId),
});
const sourceAreaOptions =
  sourceAreas.data?.data.map((area) => ({
    label: area.name,
    value: area.id,
  })) ?? [];

const destinationAreaOptions =
  destinationAreas.data?.data.map((area) => ({
    label: area.name,
    value: area.id,
  })) ?? [];

React.useEffect(() => {
  form.setValue("sourceAreaId", "");
}, [sourceCityId, form]);

React.useEffect(() => {
  form.setValue("destinationAreaId", "");
}, [destinationCityId, form]);

const wagonOptions = (wagons.data?.data ?? []).map((w) => ({
  label: w.name,
  value: w.id,
}));

  return (
    <MasterFormDialog<
      CreateRailwayFreightMatrixFormInput,
      CreateRailwayFreightMatrixBody
    >
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Railway Freight" : "Add Railway Freight"}
      form={form}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      columns={2}
    >
      {/* BASIC INFO */}
      <FormSection
        icon={<IconTrain size={18} />}
        title="Railway Freight Details"
        description="Select wagon and define route"
      >
        <SelectField<CreateRailwayFreightMatrixFormInput>
          name="wagonId"
          label="Wagon Type"
          options={wagonOptions}
          required
        />

        <IconTextField<CreateRailwayFreightMatrixFormInput>
          name="freightAmount"
          label="Freight Amount"
          placeholder="Enter freight amount"
          icon={<IconCurrencyRupee size={16} />}
          type="number"
          min={0}
          step="0.01"
          required
        />
      </FormSection>

      {/* ROUTE */}
      <FormSection
        icon={<IconMapPin size={18} />}
        title="Route Information"
        description="Source and destination cities"
      >
        <CitySelectField<CreateRailwayFreightMatrixFormInput>
  name="sourceCityId"
  label="Source City"
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

<CitySelectField<CreateRailwayFreightMatrixFormInput>
  name="destinationCityId"
  label="Destination City"
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
<SelectField<CreateRailwayFreightMatrixFormInput>
  name="sourceAreaId"
  label="Source Area"
  options={sourceAreaOptions}
  disabled={!sourceCityId}
/>

<SelectField<CreateRailwayFreightMatrixFormInput>
  name="destinationAreaId"
  label="Destination Area"
  options={destinationAreaOptions}
  disabled={!destinationCityId}
/>
      </FormSection>
    </MasterFormDialog>
  );
}
