"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type {
  Warehouse,
  City,
  State,
  Branch,
  CreateWarehouseBody,
  CreateWarehouseFormInput,
} from "@skerp/types";

import {
  IconBuildingWarehouse,
  IconCurrencyRupee,
  IconMapPin,
  IconPhone,
  IconRulerMeasure,
} from "@tabler/icons-react";

import { createWarehouseSchema } from "@skerp/validators";
import MasterFormDialog from "../_shared/MasterFormDialog";
import SelectField from "../_shared/fields/SelectField";
import IconTextField from "../_shared/fields/IconTextField";
import FormSection from "../_shared/fields/FormSection";
import TextAreaField from "../_shared/fields/TextAreaField";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: Warehouse | null;
  cities: City[];
  states: State[];
  branches: Branch[];
  onSubmit: (data: CreateWarehouseBody) => Promise<void>;
  isSubmitting?: boolean;
};

const defaultValues: CreateWarehouseFormInput = {
  name: "",
  type: "",
  address: "",
  country: "",
  stateId: "",
  cityId: "",
  branchId: "",
  contactName: "",
  contactPhone: "",
  monthlyRent: undefined,
  securityDeposit: undefined,
  length: undefined,
  width: undefined,
  breadth: undefined,
  gateNo: "",
  storageCapacity: undefined,
};

export default function WarehouseForm({
  open,
  onOpenChange,
  row,
  cities,
  states,
  branches,
  onSubmit,
  isSubmitting,
}: Props) {
  const form = useForm<CreateWarehouseFormInput, unknown, CreateWarehouseBody>({
    resolver: zodResolver(createWarehouseSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues,
  });

  React.useEffect(() => {
    if (!open) return;

    form.reset({
      name: row?.name ?? "",
      type: row?.type ?? "",
      address: row?.address ?? "",
      country: row?.country ?? "",
      stateId: row?.stateId ?? "",
      cityId: row?.cityId ?? "",
      branchId: row?.branchId ?? "",
      contactName: row?.contactName ?? "",
      contactPhone: row?.contactPhone ?? "",
      monthlyRent: row?.monthlyRent ?? undefined,
      securityDeposit: row?.securityDeposit ?? undefined,
      length: row?.length ?? undefined,
      width: row?.width ?? undefined,
      breadth: row?.breadth ?? undefined,
      gateNo: row?.gateNo ?? "",
      storageCapacity: row?.storageCapacity ?? undefined,
    });
  }, [form, open, row]);

  const cityOptions = cities.map((city) => ({
    label: city.name,
    value: city.id,
  }));

  const stateOptions = states.map((state) => ({
    label: state.name,
    value: state.id,
  }));

  const branchOptions = branches.map((branch) => ({
    label: branch.name,
    value: branch.id,
  }));

  return (
    <MasterFormDialog<CreateWarehouseFormInput, CreateWarehouseBody>
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Warehouse" : "Add Warehouse"}
      form={form}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      columns={3}
    >
      <FormSection
        icon={<IconBuildingWarehouse size={18} />}
        title="Warehouse Information"
        description="Basic warehouse identity and type"
      >
        <IconTextField<CreateWarehouseFormInput>
          name="name"
          label="Warehouse Name"
          placeholder="Enter warehouse name"
          icon={<IconBuildingWarehouse size={16} />}
          required
        />

        <IconTextField<CreateWarehouseFormInput>
          name="type"
          label="Warehouse Type"
          placeholder="Enter warehouse type"
          icon={<IconBuildingWarehouse size={16} />}
          required
        />

        <SelectField<CreateWarehouseFormInput>
          name="branchId"
          label="Branch"
          options={branchOptions}
          required
        />

        <IconTextField<CreateWarehouseFormInput>
          name="gateNo"
          label="Gate Number"
          placeholder="Enter gate number"
          icon={<IconBuildingWarehouse size={16} />}
        />
      </FormSection>

      <FormSection
        icon={<IconMapPin size={18} />}
        title="Location Details"
        description="Warehouse address and location"
      >
        <IconTextField<CreateWarehouseFormInput>
          name="country"
          label="Country"
          placeholder="Enter country"
          icon={<IconMapPin size={16} />}
          required
        />

        <SelectField<CreateWarehouseFormInput>
          name="stateId"
          label="State"
          options={stateOptions}
          required
        />

        <SelectField<CreateWarehouseFormInput>
          name="cityId"
          label="City"
          options={cityOptions}
          required
        />

        <div className="md:col-span-2 xl:col-span-3">
          <TextAreaField<CreateWarehouseFormInput>
            name="address"
            label="Address"
            placeholder="Enter warehouse address"
            rows={2}
            maxLength={250}
          />
        </div>
      </FormSection>

      <FormSection
        icon={<IconPhone size={18} />}
        title="Contact Details"
        description="Warehouse contact person and phone"
      >
        <IconTextField<CreateWarehouseFormInput>
          name="contactName"
          label="Contact Person"
          placeholder="Enter contact person"
          icon={<IconPhone size={16} />}
        />

        <IconTextField<CreateWarehouseFormInput>
          name="contactPhone"
          label="Contact Phone"
          placeholder="Enter contact phone"
          icon={<IconPhone size={16} />}
        />
      </FormSection>

      <FormSection
        icon={<IconCurrencyRupee size={18} />}
        title="Rent & Deposit"
        description="Warehouse financial details"
      >
        <IconTextField<CreateWarehouseFormInput>
          name="monthlyRent"
          label="Monthly Rent"
          placeholder="0.00"
          icon={<IconCurrencyRupee size={16} />}
          type="number"
        />

        <IconTextField<CreateWarehouseFormInput>
          name="securityDeposit"
          label="Security Deposit"
          placeholder="0.00"
          icon={<IconCurrencyRupee size={16} />}
          type="number"
        />
      </FormSection>

      <FormSection
        icon={<IconRulerMeasure size={18} />}
        title="Dimensions & Capacity"
        description="Physical size and storage capacity"
      >
        <IconTextField<CreateWarehouseFormInput>
          name="length"
          label="Length"
          placeholder="Enter length"
          icon={<IconRulerMeasure size={16} />}
          type="number"
        />

        <IconTextField<CreateWarehouseFormInput>
          name="width"
          label="Width"
          placeholder="Enter width"
          icon={<IconRulerMeasure size={16} />}
          type="number"
        />

        <IconTextField<CreateWarehouseFormInput>
          name="breadth"
          label="Breadth"
          placeholder="Enter breadth"
          icon={<IconRulerMeasure size={16} />}
          type="number"
        />

        <IconTextField<CreateWarehouseFormInput>
          name="storageCapacity"
          label="Storage Capacity"
          placeholder="Enter storage capacity"
          icon={<IconRulerMeasure size={16} />}
          type="number"
        />
      </FormSection>
    </MasterFormDialog>
  );
}