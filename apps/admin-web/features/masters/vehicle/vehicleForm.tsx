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
    defaultValues: {
      vehicleNumber: "",
      chasisNumber: "",
      engineNumber: "",
      ownershipType: "Own_Vehicle",
      vehicleType: "Container",
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
      wheels: row?.wheels ?? "",
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
      <TextField<CreateVehicleFormInput>
        name="vehicleNumber"
        label="Vehicle Number"
        placeholder="Enter vehicle number"
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

      <TextField<CreateVehicleFormInput>
        name="capacityMT"
        label="Capacity MT"
        placeholder="Enter capacity"
        required
      />

      <TextField<CreateVehicleFormInput>
        name="wheels"
        label="Wheels"
        placeholder="Enter wheels"
      />

      <TextField<CreateVehicleFormInput>
        name="bodyType"
        label="Body Type"
        placeholder="Enter body type"
      />

      <TextField<CreateVehicleFormInput>
        name="lengthFeet"
        label="Length Feet"
        placeholder="Enter length"
      />

      <TextField<CreateVehicleFormInput>
        name="openingKM"
        label="Opening KM"
        placeholder="Enter opening KM"
        required
      />

      <TextField<CreateVehicleFormInput>
        name="currentKM"
        label="Current KM"
        placeholder="Enter current KM"
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