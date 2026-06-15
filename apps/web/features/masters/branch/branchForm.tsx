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
import FormSection from "../_shared/fields/FormSection";
import TextField from "../_shared/fields/TextField";
import SelectField from "../_shared/fields/SelectField";
import PhoneField from "../_shared/fields/PhoneField";
import SwitchField from "../_shared/fields/SwitchField";

import {
  IconBuilding,
  IconMapPin,
  IconUser,
  IconReceipt,
  IconTrain,
  IconFileText,
} from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: Branch | null;
  companies: Company[];
  cities: City[];
  onSubmit: (data: CreateBranchBody) => Promise<void>;
  isSubmitting?: boolean;
};

const defaultValues: CreateBranchFormInput = {
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
  isHeadOffice: false,
  allowReceipt: true,
  companyId: "",
  warehouseId: "",
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
  const form = useForm<CreateBranchFormInput, unknown, CreateBranchBody>({
    resolver: zodResolver(createBranchSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues,
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
      isHeadOffice: row?.isHeadOffice ?? false,
      allowReceipt: row?.allowReceipt ?? true,
      companyId: row?.companyId ?? "",
      warehouseId: row?.warehouseId ?? "",
    });
  }, [form, open, row]);

  const companyOptions = companies.map((c) => ({
    label: c.name,
    value: c.id,
  }));

  const cityOptions = cities.map((c) => ({
    label: c.name,
    value: c.id,
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
      {/* BASIC INFO */}
      <FormSection
        icon={<IconBuilding size={18} />}
        title="Branch Information"
        description="Basic branch identity details"
      >
        <TextField<CreateBranchFormInput>
          name="branchCode"
          label="Branch Code"
          required
        />

        <TextField<CreateBranchFormInput>
          name="shortCode"
          label="Short Code"
          required
        />

        <TextField<CreateBranchFormInput>
          name="name"
          label="Branch Name"
          required
        />
      </FormSection>

      {/* LOCATION */}
      <FormSection
        icon={<IconMapPin size={18} />}
        title="Location Details"
        description="Branch location and company mapping"
      >
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
          name="address"
          label="Address"
        />
      </FormSection>

      {/* CONTACT */}
      <FormSection
        icon={<IconUser size={18} />}
        title="Contact Information"
        description="Branch contact person details"
      >
        <TextField<CreateBranchFormInput>
          name="contactName"
          label="Contact Name"
        />

        <PhoneField<CreateBranchFormInput>
          control={form.control}
          name="contactPhone"
          label="Contact Phone"
        />

        <TextField<CreateBranchFormInput>
          name="email"
          label="Email"
        />
      </FormSection>

      {/* BUSINESS INFO */}
      <FormSection
        icon={<IconBuilding size={18} />}
        title="Business Settings"
        description="Operational configuration"
      >
        <TextField<CreateBranchFormInput>
          name="weeklyOffDay"
          label="Weekly Off Day"
        />

        <TextField<CreateBranchFormInput>
          name="gstNo"
          label="GST Number"
        />

        <TextField<CreateBranchFormInput>
          name="workingHours"
          label="Working Hours"
        />

        <SwitchField<CreateBranchFormInput>
          name="allowLR"
          label="Allow LR"
          description="Allow lorry receipts from this branch"
          icon={<IconFileText size={14} />}
        />

        <SwitchField<CreateBranchFormInput>
          name="isRailHead"
          label="Is this a Rail Head?"
          description="Selectable as the railhead for Road & Rail order LRs"
          icon={<IconTrain size={14} />}
        />

        <SwitchField<CreateBranchFormInput>
          name="isHeadOffice"
          label="Is this the Head Office (hub)?"
          description="The HO/hub branch (Jalgaon). LR hub splits attach to this branch — set on exactly one branch."
          icon={<IconBuilding size={14} />}
        />

        <SwitchField<CreateBranchFormInput>
          name="allowReceipt"
          label="Allow Receipt"
          description="Allow receipts at this branch"
          icon={<IconReceipt size={14} />}
        />
      </FormSection>
    </MasterFormDialog>
  );
}
