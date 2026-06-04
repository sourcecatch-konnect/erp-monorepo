"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type {
  VehicleType,
  CreateVehicleTypeBody,
  CreateVehicleTypeFormInput,
} from "@skerp/types";
import { createVehicleTypeSchema } from "@skerp/validators";
import { IconTruck } from "@tabler/icons-react";

import MasterFormDialog from "../_shared/MasterFormDialog";
import FormSection from "../_shared/fields/FormSection";
import TextField from "../_shared/fields/TextField";
import SwitchField from "../_shared/fields/SwitchField";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: VehicleType | null;
  onSubmit: (data: CreateVehicleTypeBody) => Promise<void>;
  isSubmitting?: boolean;
};

export default function VehicleTypeForm({
  open,
  onOpenChange,
  row,
  onSubmit,
  isSubmitting,
}: Props) {
  const form = useForm<
    CreateVehicleTypeFormInput,
    unknown,
    CreateVehicleTypeBody
  >({
    resolver: zodResolver(createVehicleTypeSchema),
    mode: "onChange",
    defaultValues: { code: "", name: "", isActive: true },
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset({
      code: row?.code ?? "",
      name: row?.name ?? "",
      freightRangeFrom: row?.freightRangeFrom ?? undefined,
      freightRangeTo: row?.freightRangeTo ?? undefined,
      isActive: row?.isActive ?? true,
    });
  }, [form, open, row]);

  return (
    <MasterFormDialog<CreateVehicleTypeFormInput, CreateVehicleTypeBody>
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Vehicle Type" : "Add Vehicle Type"}
      form={form}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      columns={2}
    >
      <FormSection
        icon={<IconTruck size={18} />}
        title="Vehicle Type"
        description="Code, label and default freight range"
      >
        <TextField<CreateVehicleTypeFormInput>
          name="code"
          label="Code"
          placeholder="e.g. 32HQ"
          required
        />
        <TextField<CreateVehicleTypeFormInput>
          name="name"
          label="Name"
          placeholder="e.g. 32 ft High Cube"
          required
        />
        <TextField<CreateVehicleTypeFormInput>
          name="freightRangeFrom"
          label="Freight range (from)"
          placeholder="e.g. 9000"
        />
        <TextField<CreateVehicleTypeFormInput>
          name="freightRangeTo"
          label="Freight range (to)"
          placeholder="e.g. 11000"
        />
        <SwitchField<CreateVehicleTypeFormInput>
          name="isActive"
          label="Active"
          description="Available for selection on orders & vehicles"
        />
      </FormSection>
    </MasterFormDialog>
  );
}
