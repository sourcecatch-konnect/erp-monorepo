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

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: RailwayFreightMatrixWithRelations | null;
};

const defaultValues: CreateRailwayFreightMatrixFormInput = {
  wagonType: "",
  sourceCityId: "",
  destinationCityId: "",
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
      wagonType: row?.wagonType ?? "",
      sourceCityId: row?.sourceCityId ?? "",
      destinationCityId: row?.destinationCityId ?? "",
      freightAmount:
        row?.freightAmount != null ? String(paiseToRupees(row.freightAmount)) : "",
    });
  }, [open, row, form]);


const wagonOptions = (wagons.data?.data ?? []).map((w) => ({
  label: w.name,
  value: w.name,
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
          name="wagonType"
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
      </FormSection>
    </MasterFormDialog>
  );
}
