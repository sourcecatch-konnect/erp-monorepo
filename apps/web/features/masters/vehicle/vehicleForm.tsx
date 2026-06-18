"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type {
  CreateVehicleBody,
  CreateVehicleFormInput,
  Vehicle,
} from "@skerp/types";

import { createVehicleSchema } from "@skerp/validators";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import MasterFormDialog from "../_shared/MasterFormDialog";
import FormSection from "../_shared/fields/FormSection";
import TextField from "../_shared/fields/TextField";
import SelectField from "../_shared/fields/SelectField";
import ComboboxField from "../_shared/fields/ComboboxField";
import NumberField from "../_shared/fields/NumberField";
import { vehicleTypeApi } from "../vehicleType/vehicleType.service";
import { vehicleTypeKeys } from "../vehicleType/vehicleType.key";
import VehicleNumberField from "../_shared/fields/vehicleNumberField";
import { DatePicker } from "@skerp/ui/components/datepicker";

import {
  IconTruck,
  IconId,
  IconCalendar,
  IconGasStation,
  IconBarcode,
  IconEngine,
  IconScale,
  IconRuler,
  IconGauge,
  IconShieldCheck,
  IconBuildingBank,
  IconWheel,
} from "@tabler/icons-react";
import IconTextField from "../_shared/fields/IconTextField";
import { vehicleApi } from "./vehicle.service";
import { vehicleKeys } from "./vehicle.key";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";


type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: Vehicle | null;
};

const ownershipOptions = [
  { label: "Own Vehicle", value: "Own_Vehicle" },
  { label: "Market Vehicle", value: "Market_Vehicle" },
];



const vehicleStatusOptions = [
  { label: "Available", value: "AVAILABLE" },
  { label: "On Trip", value: "ON_TRIP" },
];

const defaultValues: CreateVehicleFormInput = {
  vehicleNumber: "",
  chasisNumber: "",
  engineNumber: "",
  ownershipType: "Own_Vehicle",
  vehicleTypeId: "",
  capacityMT: "",
  wheels: "",
  bodyType: "",
  lengthFeet: "",
  openingKM: "",
  currentKM: "",
  purchaseDate: "",
  insuranceNumber: "",
  insuranceCompany: "",
  insuranceIssueDate: "",
  insuranceDueDate: "",
  status: "AVAILABLE",
};
const bodyTypeOptions = [
  { label: "HQ", value: "HQ" },
  { label: "LQ", value: "LQ" },
];
export default function VehicleForm({
  open,
  onOpenChange,
  row,
}: Props) {


const { create, update } = useMasterMutations({
  api: vehicleApi,
  queryKey: vehicleKeys.all,
});

const handleSubmit = async (data: CreateVehicleBody) => {
  if (row) {
    await update.mutateAsync({ id: row.id, data });
  } else {
    await create.mutateAsync(data);
  }

  onOpenChange(false);
};
  const form = useForm<CreateVehicleFormInput, unknown, CreateVehicleBody>({
    resolver: zodResolver(createVehicleSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues,
  });

  const vehicleTypes = useQuery({
    queryKey: vehicleTypeKeys.list({ size: 1000, sort: "name:asc" }),
    queryFn: () => vehicleTypeApi.list({ size: 1000, sort: "name:asc" }),
    enabled: open,
  });

  const vehicleTypeOptions = (vehicleTypes.data?.data ?? []).map((vt) => ({
    label: vt.name,
    value: vt.id,
  }));
const isSubmitting = create.isPending || update.isPending;
  React.useEffect(() => {
    if (!open) return;

    form.reset({
      vehicleNumber: row?.vehicleNumber ?? "",
      chasisNumber: row?.chasisNumber ?? "",
      engineNumber: row?.engineNumber ?? "",
      ownershipType: row?.ownershipType ?? "Own_Vehicle",
      vehicleTypeId: row?.vehicleTypeId ?? "",
      capacityMT: row?.capacityMT != null ? String(row.capacityMT) : "",
      wheels: row?.wheels != null ? String(row.wheels) : "",
      bodyType: row?.bodyType ?? "",
      lengthFeet: row?.lengthFeet ?? "",
      openingKM: row?.openingKM != null ? String(row.openingKM) : "",
      currentKM: row?.currentKM != null ? String(row.currentKM) : "",
      purchaseDate: toDateInput(row?.purchaseDate),
      insuranceNumber: row?.insuranceNumber ?? "",
      insuranceCompany: row?.insuranceCompany ?? "",
      insuranceIssueDate: toDateInput(row?.insuranceIssueDate),
      insuranceDueDate: toDateInput(row?.insuranceDueDate),
      status: row?.status ?? "AVAILABLE",
    });
  }, [form, open, row]);

  return (
    <MasterFormDialog<CreateVehicleFormInput, CreateVehicleBody>
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Vehicle" : "Add Vehicle"}
      form={form}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      columns={3}
    >
      {/* BASIC INFO */}
      <FormSection
        icon={<IconTruck size={18} />}
        title="Vehicle Information"
        description="Basic vehicle identity details"
      >
        <VehicleNumberField<CreateVehicleFormInput>
          control={form.control}
          name="vehicleNumber"
          required
        />

       <IconTextField<CreateVehicleFormInput>
  name="chasisNumber"
  label="Chasis Number"
  placeholder="Enter the chasis number"
  icon={<IconBarcode size={16} />}
  required
/>

       <IconTextField<CreateVehicleFormInput>
  name="engineNumber"
  label="Engine Number"
    placeholder="Enter engine number"
  icon={<IconEngine size={16} />}
  required
/>
      </FormSection>

      {/* SPECIFICATIONS */}
      <FormSection
        icon={<IconTruck size={18} />}
        title="Specifications"
        description="Vehicle type and physical attributes"
      >
      <SelectField<CreateVehicleFormInput>
  name="ownershipType"
  label="Ownership Type"
  options={ownershipOptions}
  icon={<IconTruck size={16} />}
  required
/>

        <ComboboxField<CreateVehicleFormInput>
          name="vehicleTypeId"
          label="Vehicle Type"
          options={vehicleTypeOptions}
          required
        />

<IconTextField<CreateVehicleFormInput>
  name="wheels"
  label="Wheels"
  placeholder="Enter wheels"
  icon={<IconWheel size={16} />}
  type="number"
  suffix="wheels"
/>
<SelectField<CreateVehicleFormInput>
  name="bodyType"
  label="Body Type"
  options={bodyTypeOptions}
  suffix="body"
  icon={<IconTruck size={16} />}
/>

       <IconTextField<CreateVehicleFormInput>
  name="capacityMT"
  label="Capacity MT"
  placeholder="0.00"
  icon={<IconScale size={16} />}
  type="number"
  suffix="MT"
  required
/>

    <IconTextField<CreateVehicleFormInput>
  name="lengthFeet"
  label="Length (Feet)"
  placeholder="Enter the Lenght Feet"
  icon={<IconRuler size={16} />}
  type="number"
   suffix="ft"
/>
      </FormSection>

      {/* KM & USAGE */}
      <FormSection
        icon={<IconGasStation size={18} />}
        title="Usage Details"
        description="Odometer and operational data"
      >
      <IconTextField<CreateVehicleFormInput>
  name="openingKM"
  label="Opening KM"
  placeholder="0"
  icon={<IconGauge size={16} />}
  type="number"
  required
  suffix="KM"
/>

       <IconTextField<CreateVehicleFormInput>
  name="currentKM"
  label="Current KM"
  placeholder="0"
  icon={<IconGasStation size={16} />}
  type="number"
  required
  suffix="KM"
/>
      </FormSection>

      {/* INSURANCE */}
      <FormSection
        icon={<IconId size={18} />}
        title="Insurance Details"
        description="Insurance policy information"
      >
        <IconTextField<CreateVehicleFormInput>
  name="insuranceNumber"
  label="Insurance Number"
  placeholder="e.g. 33"
  icon={<IconShieldCheck size={16} />}
/>

       <IconTextField<CreateVehicleFormInput>
  name="insuranceCompany"
  label="Insurance Company"
   placeholder="e.g. HDFC ERGO"
  icon={<IconBuildingBank size={16} />}
/>

        <Controller
          control={form.control}
          name="insuranceIssueDate"
          render={({ field }) => (
            <DatePicker
              label="Insurance Issue Date"
              selected={field.value ? new Date(field.value) : undefined}
              onSelect={(d) =>
                field.onChange(d ? d.toISOString().slice(0, 10) : "")
              }
            />
          )}
        />

        <Controller
          control={form.control}
          name="insuranceDueDate"
          render={({ field }) => (
            <DatePicker
              label="Insurance Due Date"
              selected={field.value ? new Date(field.value) : undefined}
              onSelect={(d) =>
                field.onChange(d ? d.toISOString().slice(0, 10) : "")
              }
            />
          )}
        />
      </FormSection>

      {/* PURCHASE */}
  <FormSection
  icon={<IconCalendar size={18} />}
  title="Purchase & Status"
  description="Vehicle purchase date and current status"
>
  <Controller
    control={form.control}
    name="purchaseDate"
    render={({ field }) => (
      <DatePicker
        label="Purchase Date"
        selected={field.value ? new Date(field.value) : undefined}
        onSelect={(d) =>
          field.onChange(d ? d.toISOString().slice(0, 10) : "")
        }
      />
    )}
  />

  <SelectField<CreateVehicleFormInput>
    name="status"
    label="Vehicle Status"
    options={vehicleStatusOptions}
     icon={<IconTruck size={16} />}
    required
  />
</FormSection>
    </MasterFormDialog>
  );
}




function toDateInput(date: string | null | undefined): string {
  if (!date) return "";

  return new Date(date).toISOString().slice(0, 10);
}

