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

import {
  IconBuildingStore,
  IconFileCertificate,
  IconMail,
  IconMapPin,
  IconPhone,
  IconUser,
} from "@tabler/icons-react";

import { createSparePartSupplierSchema } from "@skerp/validators";

import MasterFormDialog from "../_shared/MasterFormDialog";
import SelectField from "../_shared/fields/SelectField";
import IconTextField from "../_shared/fields/IconTextField";
import TextAreaField from "../_shared/fields/TextAreaField";
import FormSection from "../_shared/fields/FormSection";

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

const defaultValues: CreateSparePartSupplierFormInput = {
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
};

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
    defaultValues,
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
      <FormSection
        icon={<IconBuildingStore size={18} />}
        title="Supplier Information"
        description="Basic supplier and shop details"
      >
        <IconTextField<CreateSparePartSupplierFormInput>
          name="name"
          label="Supplier Name"
          placeholder="Enter supplier name"
          icon={<IconUser size={16} />}
          required
        />

        <SelectField<CreateSparePartSupplierFormInput>
          name="type"
          label="Type"
          options={supplierTypeOptions}
          required
        />

        <IconTextField<CreateSparePartSupplierFormInput>
          name="shopName"
          label="Shop Name"
          placeholder="Enter shop name"
          icon={<IconBuildingStore size={16} />}
          required
        />

        <SelectField<CreateSparePartSupplierFormInput>
          name="cityId"
          label="City"
          options={cityOptions}
          required
        />
      </FormSection>

      <FormSection
        icon={<IconPhone size={18} />}
        title="Contact Details"
        description="Person, phone, mobile and email information"
      >
        <IconTextField<CreateSparePartSupplierFormInput>
          name="contactPerson"
          label="Contact Person"
          placeholder="Enter contact person"
          icon={<IconUser size={16} />}
          required
        />

        <IconTextField<CreateSparePartSupplierFormInput>
          name="contactPhone"
          label="Contact Phone"
          placeholder="10-digit contact number"
          icon={<IconPhone size={16} />}
          maxLength={10}
          required
        />

        <IconTextField<CreateSparePartSupplierFormInput>
          name="mobileNo"
          label="Mobile No"
          placeholder="10-digit mobile number"
          icon={<IconPhone size={16} />}
          maxLength={10}
        />

        <IconTextField<CreateSparePartSupplierFormInput>
          name="email"
          label="Email"
          placeholder="Enter email"
          icon={<IconMail size={16} />}
        />
      </FormSection>

      <FormSection
        icon={<IconFileCertificate size={18} />}
        title="Tax Information"
        description="PAN and GST registration details"
      >
        <IconTextField<CreateSparePartSupplierFormInput>
          name="panNo"
          label="PAN No"
          placeholder="ABCDE1234F"
          icon={<IconFileCertificate size={16} />}
          maxLength={10}
        />

        <IconTextField<CreateSparePartSupplierFormInput>
          name="gstin"
          label="GSTIN"
          placeholder="27ABCDE1234F1Z5"
          icon={<IconFileCertificate size={16} />}
          maxLength={15}
        />
      </FormSection>

      <FormSection
        icon={<IconMapPin size={18} />}
        title="Address"
        description="Supplier address details"
        columns={1}
      >
        <TextAreaField<CreateSparePartSupplierFormInput>
          name="address"
          label="Address"
          placeholder="Enter address"
          rows={3}
          maxLength={250}
        />
      </FormSection>
    </MasterFormDialog>
  );
}