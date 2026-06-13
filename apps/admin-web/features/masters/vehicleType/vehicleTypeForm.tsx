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
import { IconCurrencyRupee, IconHash, IconTag, IconTruck } from "@tabler/icons-react";
import { paiseToRupees } from "@/lib/money";

import MasterFormDialog from "../_shared/MasterFormDialog";
import FormSection from "../_shared/fields/FormSection";
import SwitchField from "../_shared/fields/SwitchField";
import IconTextField from "../_shared/fields/IconTextField";

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
  defaultValues: {
    code: "",
    name: "",
    freightRangeFrom: undefined,
    freightRangeTo: undefined,
    isActive: true,
  },
});

  React.useEffect(() => {
    if (!open) return;
    form.reset({
      code: row?.code ?? "",
      name: row?.name ?? "",
      freightRangeFrom:
        row?.freightRangeFrom != null ? paiseToRupees(row.freightRangeFrom) : undefined,
      freightRangeTo:
        row?.freightRangeTo != null ? paiseToRupees(row.freightRangeTo) : undefined,
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
        <IconTextField<CreateVehicleTypeFormInput>
  name="code"
  label="Code"
  placeholder="e.g. 32HQ"
  icon={<IconHash size={16} />}
  required
/>

<IconTextField<CreateVehicleTypeFormInput>
  name="name"
  label="Name"
  placeholder="e.g. 32 ft High Cube"
  icon={<IconTag size={16} />}
  required
/>

<IconTextField<CreateVehicleTypeFormInput>
  name="freightRangeFrom"
  label="Freight Range From (₹)"
  placeholder="e.g. 9000"
  icon={<IconCurrencyRupee size={16} />}
/>

<IconTextField<CreateVehicleTypeFormInput>
  name="freightRangeTo"
  label="Freight Range To (₹)"
  placeholder="e.g. 11000"
  icon={<IconCurrencyRupee size={16} />}
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
