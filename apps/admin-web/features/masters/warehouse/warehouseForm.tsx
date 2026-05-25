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

import { createWarehouseSchema } from "@skerp/validators";

import MasterFormDialog from "../_shared/MasterFormDialog";
import TextField from "../_shared/fields/TextField";
import SelectField from "../_shared/fields/SelectField";
import NumberField from "../_shared/fields/NumberField";
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
  const form = useForm<
    CreateWarehouseFormInput,
    unknown,
    CreateWarehouseBody
  >({
    resolver: zodResolver(createWarehouseSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
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
    },
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

  const cityOptions = cities.map((c) => ({
    label: c.name,
    value: c.id,
  }));

  const stateOptions = states.map((s) => ({
    label: s.name,
    value: s.id,
  }));

  const branchOptions = branches.map((b) => ({
    label: b.name,
    value: b.id,
  }));

  return (
    <MasterFormDialog<CreateWarehouseFormInput, CreateWarehouseBody>
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Warehouse" : "Add Warehouse"}
      form={form}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      columns={2}
    >
      {/* NAME */}
      <TextField<CreateWarehouseFormInput>
        name="name"
        label="Warehouse Name"
        required
      />

      {/* TYPE */}
      <TextField<CreateWarehouseFormInput>
        name="type"
        label="Warehouse Type"
        required
      />

      {/* ADDRESS */}
      <TextField<CreateWarehouseFormInput>
        name="address"
        label="Address"
      />

      {/* COUNTRY */}
      <TextField<CreateWarehouseFormInput>
        name="country"
        label="Country"
        required
      />

      {/* STATE */}
      <SelectField<CreateWarehouseFormInput>
        name="stateId"
        label="State"
        options={stateOptions}
        required
      />

      {/* CITY */}
      <SelectField<CreateWarehouseFormInput>
        name="cityId"
        label="City"
        options={cityOptions}
        required
      />

      {/* BRANCH */}
      <SelectField<CreateWarehouseFormInput>
        name="branchId"
        label="Branch"
        options={branchOptions}
        required
      />

      {/* CONTACT */}
      <TextField<CreateWarehouseFormInput>
        name="contactName"
        label="Contact Person"
      />

      <TextField<CreateWarehouseFormInput>
        name="contactPhone"
        label="Contact Phone"
      />

      {/* FINANCE */}
      <NumberField<CreateWarehouseFormInput>
  name="monthlyRent"
  label="Monthly Rent"
  control={form.control}
/>


    <NumberField<CreateWarehouseFormInput>
  name="securityDeposit"
  label="Security Deposit"
  control={form.control}
/>

      {/* DIMENSIONS */}
      <NumberField<CreateWarehouseFormInput>
  name="length"
  label="Length"
  control={form.control}
/>

<NumberField<CreateWarehouseFormInput>
  name="width"
  label="Width"
  control={form.control}
/>

<NumberField<CreateWarehouseFormInput>
  name="breadth"
  label="Breadth"
  control={form.control}
/>

      {/* OTHERS */}
      <TextField<CreateWarehouseFormInput>
        name="gateNo"
        label="Gate Number"
      />

     <NumberField<CreateWarehouseFormInput>
  name="storageCapacity"
  label="Storage Capacity"
  control={form.control}
/>
    </MasterFormDialog>
  );
}