"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type {
  Agreement,
  CreateAgreementBody,
  CreateAgreementFormInput,
  Company,
  Customer,
  City,
  Branch,
} from "@skerp/types";

import { createAgreementSchema } from "@skerp/validators";

import MasterFormDialog from "../_shared/MasterFormDialog";
import FormSection from "../_shared/fields/FormSection";
import IconTextField from "../_shared/fields/IconTextField";
import SelectField from "../_shared/fields/SelectField";

import {
  IconBuilding,
  IconMapPin,
  IconCalendar,
  IconTruck,
} from "@tabler/icons-react";
import { DatePicker } from "@skerp/ui/components/datepicker";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  row?: Agreement | null;
  onSubmit: (data: CreateAgreementBody) => Promise<void>;
  isSubmitting?: boolean;

  companies: Company[];
  customers: Customer[];
  cities: City[];
  branches: Branch[];
};

const defaultValues: CreateAgreementFormInput = {
  companyId: "",
  clientId: "",
  cityId: "",
  leadGeneratedByBranchId: "",
  startDate: "",
  agreementDate: "",
  expiryDate: "",
  carryingCapacity: "",
};

export default function AgreementForm({
  open,
  onOpenChange,
  row,
  onSubmit,
  isSubmitting,
  companies,
  customers,
  cities,
  branches,
}: Props) {
const form = useForm<CreateAgreementFormInput, unknown, CreateAgreementBody>({
  resolver: zodResolver(createAgreementSchema),
  defaultValues,
  mode: "onChange",
  reValidateMode: "onChange",
});

  React.useEffect(() => {
    if (!open) return;

    form.reset({
      companyId: row?.companyId ?? "",
      clientId: row?.clientId ?? "",
      cityId: row?.cityId ?? "",
      leadGeneratedByBranchId: row?.leadGeneratedByBranchId ?? "",
      startDate: row?.startDate ? String(row.startDate) : "",
      agreementDate: row?.agreementDate ? String(row.agreementDate) : "",
      expiryDate: row?.expiryDate ? String(row.expiryDate) : "",
      carryingCapacity: row?.carryingCapacity?.toString() ?? "",
    });
  }, [open, row, form]);

  return (
    <MasterFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Agreement" : "Add Agreement"}
      form={form}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      columns={3}
    >
      {/* ================= COMPANY & CLIENT ================= */}
      <FormSection
        icon={<IconBuilding size={18} />}
        title="Parties"
        description="Company and customer involved in agreement"
      >
        <SelectField
          name="companyId"
          label="Company"
          options={companies.map((c) => ({
            label: c.name,
            value: c.id,
          }))}
        />

        <SelectField
          name="clientId"
          label="Customer"
          options={customers.map((c) => ({
            label: c.name,
            value: c.id,
          }))}
        />
      </FormSection>

      {/* ================= LOCATION ================= */}
      <FormSection
        icon={<IconMapPin size={18} />}
        title="Location Details"
        description="City and branch responsible for agreement"
      >
        <SelectField
          name="cityId"
          label="City"
          options={cities.map((c) => ({
            label: c.name,
            value: c.id,
          }))}
        />

        <SelectField
          name="leadGeneratedByBranchId"
          label="Branch"
          options={branches.map((b) => ({
            label: b.name,
            value: b.id,
          }))}
        />
      </FormSection>

      {/* ================= AGREEMENT TIMELINE ================= */}
      <FormSection
  icon={<IconCalendar size={18} />}
  title="Agreement Timeline"
  description="Start, signing and expiry dates"
>
<Controller
  control={form.control}
  name="startDate"
  render={({ field }) => (
    <div>
      <DatePicker
        label="Start Date *"
        selected={field.value ? new Date(field.value) : undefined}
 onSelect={async (date) => {
  field.onChange(date ? date.toISOString().slice(0, 10) : "");
  await form.trigger("startDate");
}}
      />
      <p className="text-xs text-red-500">
        {form.formState.errors.startDate?.message}
      </p>
    </div>
  )}
/>

  <Controller
    control={form.control}
    name="agreementDate"
    render={({ field }) => (
      <div>
      <DatePicker
        label="Agreement Date"
        selected={field.value ? new Date(field.value) : undefined}
       onSelect={(date) => {
  field.onChange(date ? date.toISOString().slice(0, 10) : "");
  form.trigger("agreementDate");
}}
      />
      <p className="text-xs text-red-500">
        {form.formState.errors.agreementDate?.message}
      </p>
      </div>
      
    )}
  />

  <Controller
    control={form.control}
    name="expiryDate"
    render={({ field }) => (
      <div>
      <DatePicker
        label="Expiry Date *"
        selected={field.value ? new Date(field.value) : undefined}
   onSelect={async (date) => {
  field.onChange(date ? date.toISOString().slice(0, 10) : "");
  await form.trigger(["expiryDate", "startDate"]);
}}
      />
        <p className="text-xs text-red-500">
        {form.formState.errors.expiryDate?.message}
      </p>
      </div>
    )}
  />
</FormSection>

      {/* ================= TRANSPORT DETAILS ================= */}
      <FormSection
        icon={<IconTruck size={18} />}
        title="Transport Terms"
        description="Capacity and logistics conditions"
      >
        <IconTextField
          name="carryingCapacity"
          label="Carrying Capacity (Ton)"
          type="number"
          placeholder="Enter capacity"
        />
      </FormSection>
    </MasterFormDialog>
  );
}