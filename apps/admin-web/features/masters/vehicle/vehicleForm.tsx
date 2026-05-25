"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type {
  CreateVehicleBody,
  CreateVehicleFormInput,
  Vehicle,
} from "@skerp/types";

import { DatePicker } from "../_shared/fields/DateField";
import MasterFormDialog from "../_shared/MasterFormDialog";
import SelectField from "../_shared/fields/SelectField";
import TextField from "../_shared/fields/TextField";
import { createVehicleSchema } from "@skerp/validators";
import NumberField from "../_shared/fields/NumberField";
import VehicleNumberField from "../_shared/fields/vehicleNumberField";
type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: Vehicle | null;
  onSubmit: (data: CreateVehicleBody) => Promise<void>;
  isSubmitting?: boolean;
};

const ownershipOptions = [
  { label: "Own Vehicle", value: "Own_Vehicle" },
  { label: "Market Vehicle", value: "Market_Vehicle" },
];
const wheelOptions = [
  { label: "2 Wheel", value: "2" },
  { label: "4 Wheel", value: "4" },
  { label: "6 Wheel", value: "6" },
  { label: "10 Wheel", value: "10" },
  { label: "12 Wheel", value: "12" },
  { label: "14 Wheel", value: "14" },
  { label: "16 Wheel", value: "16" },
  { label: "18 Wheel", value: "18" },
  { label: "22 Wheel", value: "22" },
];
const wheelValues = ["2", "4", "6", "10", "12", "14", "16", "18", "22"] as const;

const toWheelInput = (value?: string | null) => {
  if (!value) return undefined;

  return wheelValues.includes(value as (typeof wheelValues)[number])
    ? (value as (typeof wheelValues)[number])
    : undefined;
};
const vehicleTypeOptions = [
  { label: "Container", value: "Container" },
  { label: "Open Body", value: "Open_Body" },
  { label: "TATA 407", value: "TATA_407" },
  { label: "DCM Lorry", value: "DCM_Lorry" },
  { label: "DI Pickup", value: "DI_Pickup" },
];

const vehicleStatusOptions = [
  { label: "Available", value: "AVAILABLE" },
  { label: "On Trip", value: "ON_TRIP" },
];

const toDateInput = (value?: string | null) => {
  if (!value) return "";

  return value.slice(0, 10);
};

export default function VehicleForm({
  open,
  onOpenChange,
  row,
  onSubmit,
  isSubmitting,
}: Props) {
  const form = useForm<CreateVehicleFormInput, unknown, CreateVehicleBody>({
    resolver: zodResolver(createVehicleSchema),
    mode: "onChange",
  reValidateMode: "onChange",
    defaultValues: {
      vehicleNumber: "",
      chasisNumber: "",
      engineNumber: "",
      ownershipType: "Own_Vehicle",
      vehicleType: "Container",
      capacityMT: "",
      wheels: undefined,
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
    },
  });

  React.useEffect(() => {
    if (!open) return;

    form.reset({
      vehicleNumber: row?.vehicleNumber ?? "",
      chasisNumber: row?.chasisNumber ?? "",
      engineNumber: row?.engineNumber ?? "",
      ownershipType: row?.ownershipType ?? "Own_Vehicle",
      vehicleType: row?.vehicleType ?? "Container",
      capacityMT: row?.capacityMT != null ? String(row.capacityMT) : "",
      wheels: toWheelInput(row?.wheels),
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
  onSubmit={onSubmit}
  isSubmitting={isSubmitting}
  columns={3}
>
 <VehicleNumberField<CreateVehicleFormInput>
  control={form.control}
  name="vehicleNumber"
  required
/>

      <TextField<CreateVehicleFormInput>
        name="chasisNumber"
        label="Chasis Number"
        placeholder="Enter chasis number"
        required
      />

      <TextField<CreateVehicleFormInput>
        name="engineNumber"
        label="Engine Number"
        placeholder="Enter engine number"
        required
      />

      <SelectField<CreateVehicleFormInput>
        name="ownershipType"
        label="Ownership Type"
        options={ownershipOptions}
        required
      />

      <SelectField<CreateVehicleFormInput>
        name="vehicleType"
        label="Vehicle Type"
        options={vehicleTypeOptions}
        required
      />

    <NumberField<CreateVehicleFormInput>
  control={form.control}
  name="capacityMT"
  label="Capacity MT"
  placeholder="Enter capacity"
  min={0.1}
  max={100}
  step="0.1"
  required
/>

    <SelectField<CreateVehicleFormInput>
  name="wheels"
  label="Wheels"
  options={wheelOptions}
/>

      <TextField<CreateVehicleFormInput>
        name="bodyType"
        label="Body Type"
        placeholder="Enter body type"
      />

    <NumberField<CreateVehicleFormInput>
  control={form.control}
  name="lengthFeet"
  label="Length Feet"
  placeholder="Enter length"
  min={1}
  max={100}
/>


    <NumberField<CreateVehicleFormInput>
  control={form.control}
  name="openingKM"
  label="Opening KM"
  placeholder="Enter opening KM"
  min={0}
  max={9999999}
  required
/>
   <NumberField<CreateVehicleFormInput>
  control={form.control}
  name="currentKM"
  label="Current KM"
  placeholder="Enter current KM"
  min={0}
  max={9999999}
  required
/>
<Controller
  control={form.control}
  name="purchaseDate"
  render={({ field }) => (
    <DatePicker
      label="Purchase Date"
      selected={field.value ? new Date(field.value) : undefined}
      onSelect={(date) => field.onChange(date ? date.toISOString().slice(0, 10) : "")}
    />
  )}
/>

<Controller
  control={form.control}
  name="insuranceIssueDate"
  render={({ field }) => (
    <DatePicker
      label="Insurance Issue Date"
      selected={field.value ? new Date(field.value) : undefined}
      onSelect={(date) => field.onChange(date ? date.toISOString().slice(0, 10) : "")}
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
      onSelect={(date) => field.onChange(date ? date.toISOString().slice(0, 10) : "")}
    />
  )}
/>

      <TextField<CreateVehicleFormInput>
        name="insuranceNumber"
        label="Insurance Number"
        placeholder="Enter insurance number"
      />

      <TextField<CreateVehicleFormInput>
        name="insuranceCompany"
        label="Insurance Company"
        placeholder="Enter insurance company"
      />

   

    

      <SelectField<CreateVehicleFormInput>
        name="status"
        label="Status"
        options={vehicleStatusOptions}
        required
      />
    </MasterFormDialog>
  );
}