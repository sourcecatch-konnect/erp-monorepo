"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type {
  CreateRailwayFreightMatrixBody,
  CreateRailwayFreightMatrixFormInput,
  RailwayFreightMatrix,
  City,
  Wagon,
} from "@skerp/types";

import { createRailwayFreightMatrixSchema } from "@skerp/validators";

import MasterFormDialog from "../_shared/MasterFormDialog";
import FormSection from "../_shared/fields/FormSection";
import IconTextField from "../_shared/fields/IconTextField";
import SelectField from "../_shared/fields/SelectField";

import {
  IconTrain,
  IconMapPin,
  IconCurrencyRupee,
} from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: RailwayFreightMatrix | null;
  onSubmit: (data: CreateRailwayFreightMatrixBody) => Promise<void>;
  isSubmitting?: boolean;
  cities: City[];
  wagons: Wagon[];
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
  onSubmit,
  isSubmitting,
  cities,
  wagons,
}: Props) {
  const form = useForm<
    CreateRailwayFreightMatrixFormInput,
    unknown,
    CreateRailwayFreightMatrixBody
  >({
    resolver: zodResolver(createRailwayFreightMatrixSchema),
    defaultValues,
  });

  React.useEffect(() => {
    if (!open) return;

    form.reset({
      wagonType: row?.wagonType ?? "",
      sourceCityId: row?.sourceCityId ?? "",
      destinationCityId: row?.destinationCityId ?? "",
      freightAmount:
        row?.freightAmount != null ? String(row.freightAmount) : "",
    });
  }, [open, row, form]);

  const cityOptions = cities.map((c) => ({
    label: c.name,
    value: c.id,
  }));

  const wagonOptions = wagons.map((w) => ({
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
      onSubmit={onSubmit}
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
        <SelectField<CreateRailwayFreightMatrixFormInput>
          name="sourceCityId"
          label="Source City"
          options={cityOptions}
          required
        />

        <SelectField<CreateRailwayFreightMatrixFormInput>
          name="destinationCityId"
          label="Destination City"
          options={cityOptions}
          required
        />
      </FormSection>
    </MasterFormDialog>
  );
}