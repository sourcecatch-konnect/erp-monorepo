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

import MasterFormDialog from "../_shared/MasterFormDialog";
import FormSection from "../_shared/fields/FormSection";
import TextField from "../_shared/fields/TextField";
import SelectField from "../_shared/fields/SelectField";
import NumberField from "../_shared/fields/NumberField";
import VehicleNumberField from "../_shared/fields/vehicleNumberField";
import { DatePicker } from "@skerp/ui/components/datepicker";

import {
  IconTruck,
  IconId,
  IconCalendar,
  IconGasStation,
} from "@tabler/icons-react";

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

const vehicleStatusOptions = [
  { label: "Available", value: "AVAILABLE" },
  { label: "On Trip", value: "ON_TRIP" },
];

const defaultValues: CreateVehicleFormInput = {
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
    defaultValues,
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

        <TextField<CreateVehicleFormInput>
          name="chasisNumber"
          label="Chasis Number"
          required
        />

        <TextField<CreateVehicleFormInput>
          name="engineNumber"
          label="Engine Number"
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
          required
        />

        <SelectField<CreateVehicleFormInput>
          name="vehicleType"
          label="Vehicle Type"
          options={vehicleTypeOptions}
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
        />

        <NumberField<CreateVehicleFormInput>
          control={form.control}
          name="capacityMT"
          label="Capacity MT"
          min={0.1}
          max={100}
          step="0.1"
          required
        />

        <NumberField<CreateVehicleFormInput>
          control={form.control}
          name="lengthFeet"
          label="Length (Feet)"
          min={1}
          max={100}
        />
      </FormSection>

      {/* KM & USAGE */}
      <FormSection
        icon={<IconGasStation size={18} />}
        title="Usage Details"
        description="Odometer and operational data"
      >
        <NumberField<CreateVehicleFormInput>
          control={form.control}
          name="openingKM"
          label="Opening KM"
          min={0}
          max={9999999}
          required
        />

        <NumberField<CreateVehicleFormInput>
          control={form.control}
          name="currentKM"
          label="Current KM"
          min={0}
          max={9999999}
          required
        />
      </FormSection>

      {/* INSURANCE */}
      <FormSection
        icon={<IconId size={18} />}
        title="Insurance Details"
        description="Insurance policy information"
      >
        <TextField<CreateVehicleFormInput>
          name="insuranceNumber"
          label="Insurance Number"
        />

        <TextField<CreateVehicleFormInput>
          name="insuranceCompany"
          label="Insurance Company"
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
        title="Purchase Details"
        description="Vehicle purchase information"
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
      </FormSection>

      {/* STATUS */}
      <FormSection
        icon={<IconTruck size={18} />}
        title="Status"
      >
        <SelectField<CreateVehicleFormInput>
          name="status"
          label="Vehicle Status"
          options={vehicleStatusOptions}
          required
        />
      </FormSection>
    </MasterFormDialog>
  );
}

function toWheelInput(
  wheels: string | null | undefined
): "2" | "4" | "6" | "10" | "12" | "14" | "16" | "18" | "22" | undefined {
  if (!wheels) return undefined;

  const value = String(wheels);

  const allowed = ["2", "4", "6", "10", "12", "14", "16", "18", "22"] as const;

  return allowed.includes(value as any) ? (value as any) : undefined;
}

function toDateInput(date: string | null | undefined): string {
  if (!date) return "";

  return new Date(date).toISOString().slice(0, 10);
}

