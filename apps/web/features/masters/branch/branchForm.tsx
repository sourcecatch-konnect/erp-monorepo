"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type {
  Branch,
  CreateBranchBody,
  CreateBranchFormInput,
} from "@skerp/types";
import {
  IconBuilding,
  IconCalendar,
  IconClock,
  IconFileText,
  IconId,
  IconMail,
  IconMapPin,
  IconReceipt,
  IconTrain,
  IconUser,
} from "@tabler/icons-react";

import { createBranchSchema } from "@skerp/validators";
import MasterFormDialog from "../_shared/MasterFormDialog";
import FormSection from "../_shared/fields/FormSection";
import IconTextField from "../_shared/fields/IconTextField";
import SelectField from "../_shared/fields/SelectField";
import PhoneField from "../_shared/fields/PhoneField";
import SwitchField from "../_shared/fields/SwitchField";
import CitySelectField from "../_shared/fields/CitySelectField";
import { companyApi } from "../Company/company.service";
import { companyKeys } from "../Company/company.key";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";
import { branchApi } from "./branch.service";
import { branchKeys } from "./branch.key";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: Branch | null;
};

const weeklyOffDays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

type WeeklyOffDay = (typeof weeklyOffDays)[number];

const isWeeklyOffDay = (value?: string | null): value is WeeklyOffDay =>
  typeof value === "string" &&
  (weeklyOffDays as readonly string[]).includes(value);

const toWeeklyOffDay = (
  value?: string | null,
): CreateBranchFormInput["weeklyOffDay"] => {
  return isWeeklyOffDay(value) ? value : "";
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

export default function BranchForm({ open, onOpenChange, row }: Props) {
  const form = useForm<CreateBranchFormInput, unknown, CreateBranchBody>({
    resolver: zodResolver(createBranchSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues,
  });

  const companies = useQuery({
    queryKey: companyKeys.list({ page: 0, size: 1000 }),
    queryFn: () => companyApi.list({ page: 0, size: 1000 }),
    enabled: open,
  });

  const { create, update } = useMasterMutations({
    api: branchApi,
    queryKey: branchKeys.all,
    entityName: "Branch",
  });

  const handleSubmit = async (data: CreateBranchBody) => {
    if (row) {
      await update.mutateAsync({ id: row.id, data });
    } else {
      await create.mutateAsync(data);
    }

    onOpenChange(false);
  };

  const isSubmitting = create.isPending || update.isPending;

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
      weeklyOffDay: toWeeklyOffDay(row?.weeklyOffDay),
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

  const companyOptions = (companies.data?.data ?? []).map((company) => ({
    label: company.name,
    value: company.id,
  }));

  return (
    <MasterFormDialog<CreateBranchFormInput, CreateBranchBody>
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Branch" : "Add Branch"}
      form={form}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      columns={3}
    >
      <FormSection
        icon={<IconBuilding size={18} />}
        title="Branch Information"
        description="Basic branch identity details"
      >
        <IconTextField<CreateBranchFormInput>
          name="branchCode"
          label="Branch Code"
          placeholder="Enter branch code"
          icon={<IconId size={16} />}
          onChangeTransform={(value) => value.toUpperCase()}
          required
        />

        <IconTextField<CreateBranchFormInput>
          name="shortCode"
          label="Short Code"
          placeholder="Enter short code"
          icon={<IconId size={16} />}
          onChangeTransform={(value) => value.toUpperCase()}
          required
        />

        <IconTextField<CreateBranchFormInput>
          name="name"
          label="Branch Name"
          placeholder="Enter branch name"
          icon={<IconBuilding size={16} />}
          required
        />
      </FormSection>

      <FormSection
        icon={<IconMapPin size={18} />}
        title="Location Details"
        description="Branch location and company mapping"
      >
        <SelectField<CreateBranchFormInput>
          name="companyId"
          label="Company"
          icon={<IconBuilding size={16} />}
          options={companyOptions}
          required
        />

        <CitySelectField<CreateBranchFormInput>
          name="cityId"
          label="City"
          initialCity={
            row?.city
              ? {
                  id: row.city.id,
                  name: row.city.name,
                }
              : null
          }
        />

        <IconTextField<CreateBranchFormInput>
          name="address"
          label="Address"
          placeholder="Enter address"
          icon={<IconMapPin size={16} />}
        />
      </FormSection>

      <FormSection
        icon={<IconUser size={18} />}
        title="Contact Information"
        description="Branch contact person details"
      >
        <IconTextField<CreateBranchFormInput>
          name="contactName"
          label="Contact Name"
          placeholder="Enter contact name"
          icon={<IconUser size={16} />}
        />

        <PhoneField<CreateBranchFormInput>
          control={form.control}
          name="contactPhone"
          label="Contact Phone"
        />

        <IconTextField<CreateBranchFormInput>
          name="email"
          label="Email"
          placeholder="Enter email"
          type="email"
          icon={<IconMail size={16} />}
        />
      </FormSection>

      <FormSection
        icon={<IconBuilding size={18} />}
        title="Business Settings"
        description="Operational configuration"
      >
        <SelectField<CreateBranchFormInput>
          name="weeklyOffDay"
          label="Weekly Off Day"
          icon={<IconCalendar size={16} />}
          options={weeklyOffDays.map((day) => ({
            label: day,
            value: day,
          }))}
        />

        <IconTextField<CreateBranchFormInput>
          name="gstNo"
          label="GST Number"
          placeholder="27ABCDE1234F1Z5"
          maxLength={15}
          icon={<IconId size={16} />}
          onChangeTransform={(value) => value.toUpperCase()}
        />

        <IconTextField<CreateBranchFormInput>
          name="workingHours"
          label="Working Hours"
          placeholder="10:00 AM - 7:00 PM"
          icon={<IconClock size={16} />}
        />
      </FormSection>

      <FormSection
        icon={<IconBuilding size={18} />}
        title="Branch Permissions"
        description="Control branch operational permissions"
      >
        <SwitchField<CreateBranchFormInput>
          name="allowLR"
          label="Allow LR"
          description="Allow lorry receipt creation from this branch"
          icon={<IconFileText size={14} />}
        />

        <SwitchField<CreateBranchFormInput>
          name="allowReceipt"
          label="Allow Receipt"
          description="Allow receipt entry for this branch"
          icon={<IconReceipt size={14} />}
        />

        <SwitchField<CreateBranchFormInput>
          name="isRailHead"
          label="Rail Head"
          description="Mark this branch as rail head"
          icon={<IconTrain size={14} />}
        />

        <SwitchField<CreateBranchFormInput>
          name="isHeadOffice"
          label="Head Office"
          description="Mark this branch as HO / hub branch"
          icon={<IconBuilding size={14} />}
        />
      </FormSection>
    </MasterFormDialog>
  );
}
