"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type {
  Branch,
  Company,
  City,
  CreateBranchBody,
  CreateBranchFormInput,
} from "@skerp/types";

import { createBranchSchema } from "@skerp/validators";

import MasterFormDialog from "../_shared/MasterFormDialog";
import TextField from "../_shared/fields/TextField";
import SelectField from "../_shared/fields/SelectField";
import PhoneField from "../_shared/fields/PhoneField";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: Branch | null;
  companies: Company[];
  cities: City[];
  onSubmit: (data: CreateBranchBody) => Promise<void>;
  isSubmitting?: boolean;
};

export default function BranchForm({
  open,
  onOpenChange,
  row,
  companies,
  cities,
  onSubmit,
  isSubmitting,
}: Props) {
  const form = useForm<
    CreateBranchFormInput,
    unknown,
    CreateBranchBody
  >({
    resolver: zodResolver(createBranchSchema),
    mode: "onChange",
    reValidateMode: "onChange",

    defaultValues: {
      branchCode: "",
      shortCode: "",
      name: "",
      cityId: "",
      address: "",
      contactName: "",
      contactPhone: "",
      email: "",
      weeklyOffDay: "",
      gstNo: "",
      workingHours: "",
      allowLR: false,
      isRailHead: false,
      allowReceipt: true,
      companyId: "",
      warehouseId: "",
    },
  });

  React.useEffect(() => {
    if (!open) return;

    form.reset({
      branchCode: row?.branchCode ?? "",
      shortCode: row?.shortCode ?? "",
      name: row?.name ?? "",
      cityId: row?.cityId ?? "",
      address: row?.address ?? "",
      contactName: row?.contactName ?? "",
      contactPhone: row?.contactPhone ?? "",
      email: row?.email ?? "",
      weeklyOffDay: row?.weeklyOffDay ?? "",
      gstNo: row?.gstNo ?? "",
      workingHours: row?.workingHours ?? "",
      allowLR: row?.allowLR ?? false,
      isRailHead: row?.isRailHead ?? false,
      allowReceipt: row?.allowReceipt ?? true,
      companyId: row?.companyId ?? "",
      warehouseId: row?.warehouseId ?? "",
    });
  }, [form, open, row]);

  const companyOptions = companies.map((company) => ({
    label: company.name,
    value: company.id,
  }));

  const cityOptions = cities.map((city) => ({
    label: city.name,
    value: city.id,
  }));

  return (
    <MasterFormDialog<CreateBranchFormInput, CreateBranchBody>
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Branch" : "Add Branch"}
      form={form}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      columns={3}
    >
      <TextField<CreateBranchFormInput>
        name="branchCode"
        label="Branch Code"
        placeholder="Enter branch code"
        required
      />

      <TextField<CreateBranchFormInput>
        name="shortCode"
        label="Short Code"
        placeholder="Enter short code"
        required
      />

      <TextField<CreateBranchFormInput>
        name="name"
        label="Branch Name"
        placeholder="Enter branch name"
        required
      />

      <SelectField<CreateBranchFormInput>
        name="companyId"
        label="Company"
        options={companyOptions}
      />

      <SelectField<CreateBranchFormInput>
        name="cityId"
        label="City"
        options={cityOptions}
      />

      <TextField<CreateBranchFormInput>
        name="contactName"
        label="Contact Name"
        placeholder="Enter contact name"
      />

      <PhoneField<CreateBranchFormInput>
        control={form.control}
        name="contactPhone"
        label="Contact Phone"
      />

      <TextField<CreateBranchFormInput>
        name="email"
        label="Email"
        placeholder="Enter email"
      />

      <TextField<CreateBranchFormInput>
        name="weeklyOffDay"
        label="Weekly Off Day"
        placeholder="Sunday"
      />

      <TextField<CreateBranchFormInput>
        name="gstNo"
        label="GST No"
        placeholder="Enter GST number"
      />

      <TextField<CreateBranchFormInput>
        name="workingHours"
        label="Working Hours"
        placeholder="9AM - 6PM"
      />

      <TextField<CreateBranchFormInput>
        name="address"
        label="Address"
        placeholder="Enter address"
      />
    </MasterFormDialog>
  );
}