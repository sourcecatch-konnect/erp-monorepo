"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type {
  City,
  SparePartSupplier,
  CreateSparePartSupplierBody,
  CreateSparePartSupplierFormInput,
} from "@skerp/types";

import { createSparePartSupplierSchema } from "@skerp/validators";

import MasterFormDialog from "../_shared/MasterFormDialog";
import TextField from "../_shared/fields/TextField";
import SelectField from "../_shared/fields/SelectField";
import UppercaseTextField from "../_shared/fields/UppercaseTextField";
import PhoneField from "../_shared/fields/PhoneField";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: SparePartSupplier | null;
  cities: City[];
  onSubmit: (data: CreateSparePartSupplierBody) => Promise<void>;
  isSubmitting?: boolean;
};

const supplierTypeOptions = [
  { label: "Item", value: "Item" },
  { label: "Service", value: "Service" },
];

export default function SparePartSupplierForm({
  open,
  onOpenChange,
  row,
  cities,
  onSubmit,
  isSubmitting,
}: Props) {
  const form = useForm<
    CreateSparePartSupplierFormInput,
    unknown,
    CreateSparePartSupplierBody
  >({
    resolver: zodResolver(createSparePartSupplierSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      name: "",
      type: "Item",
      shopName: "",
      address: "",
      cityId: "",
      contactPerson: "",
      contactPhone: "",
      mobileNo: "",
      email: "",
      panNo: "",
      gstin: "",
    },
  });

  React.useEffect(() => {
    if (!open) return;

    form.reset({
      name: row?.name ?? "",
      type: row?.type ?? "Item",
      shopName: row?.shopName ?? "",
      address: row?.address ?? "",
      cityId: row?.cityId ?? "",
      contactPerson: row?.contactPerson ?? "",
      contactPhone: row?.contactPhone ?? "",
      mobileNo: row?.mobileNo ?? "",
      email: row?.email ?? "",
      panNo: row?.panNo ?? "",
      gstin: row?.gstin ?? "",
    });
  }, [form, open, row]);

  const cityOptions = cities.map((city) => ({
    label: city.name,
    value: city.id,
  }));

  return (
    <MasterFormDialog<
      CreateSparePartSupplierFormInput,
      CreateSparePartSupplierBody
    >
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Spare Part Supplier" : "Add Spare Part Supplier"}
      form={form}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      columns={3}
    >
      <TextField<CreateSparePartSupplierFormInput>
        name="name"
        label="Supplier Name"
        placeholder="Enter supplier name"
        required
      />

      <SelectField<CreateSparePartSupplierFormInput>
        name="type"
        label="Type"
        options={supplierTypeOptions}
        required
      />

      <TextField<CreateSparePartSupplierFormInput>
        name="shopName"
        label="Shop Name"
        placeholder="Enter shop name"
        required
      />

      <SelectField<CreateSparePartSupplierFormInput>
        name="cityId"
        label="City"
        options={cityOptions}
        required
      />

      <TextField<CreateSparePartSupplierFormInput>
        name="contactPerson"
        label="Contact Person"
        placeholder="Enter contact person"
        required
      />

    <PhoneField<CreateSparePartSupplierFormInput>
  control={form.control}
  name="contactPhone"
  label="Contact Phone"
  required
/>
      <PhoneField<CreateSparePartSupplierFormInput>
  control={form.control}
  name="mobileNo"
  label="Mobile No"
/>

      <TextField<CreateSparePartSupplierFormInput>
        name="email"
        label="Email"
        placeholder="Enter email"
      />

      <UppercaseTextField<CreateSparePartSupplierFormInput>
        control={form.control}
        name="panNo"
        label="PAN No"
        placeholder="ABCDE1234F"
        maxLength={10}
      />

      <UppercaseTextField<CreateSparePartSupplierFormInput>
        control={form.control}
        name="gstin"
        label="GSTIN"
        placeholder="27ABCDE1234F1Z5"
        maxLength={15}
      />

      <TextField<CreateSparePartSupplierFormInput>
        name="address"
        label="Address"
        placeholder="Enter address"
      />
    </MasterFormDialog>
  );
}