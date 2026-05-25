"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type {
  Company,
  State,
  City,
  CreateCompanyBody,
  CreateCompanyFormInput,
} from "@skerp/types";

import { createCompanySchema } from "@skerp/validators";
import { DatePicker } from "../_shared/fields/DateField";
import MasterFormDialog from "../_shared/MasterFormDialog";
import TextField from "../_shared/fields/TextField";
import SelectField from "../_shared/fields/SelectField";
import UppercaseTextField from "../_shared/fields/UppercaseTextField";
import PhoneField from "../_shared/fields/PhoneField";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: Company | null;
  states: State[];
  cities: City[];
  onSubmit: (data: CreateCompanyBody) => Promise<void>;
  isSubmitting?: boolean;
};

export default function CompanyForm({
  open,
  onOpenChange,
  row,
  states,
  cities,
  onSubmit,
  isSubmitting,
}: Props) {
  const form = useForm<
    CreateCompanyFormInput,
    unknown,
    CreateCompanyBody
  >({
    resolver: zodResolver(createCompanySchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      name: "",
      address: "",
      country: "India",
      stateId: "",
      cityId: "",
      contactPhone: "",
      establishmentYear: "",
      companyPAN: "",
      mainLogoPath: "",
      companyTAN: "",
    },
  });

  React.useEffect(() => {
    if (!open) return;

    form.reset({
      name: row?.name ?? "",
      address: row?.address ?? "",
      country: row?.country ?? "India",
      stateId: row?.stateId ?? "",
      cityId: row?.cityId ?? "",
      contactPhone: row?.contactPhone ?? "",
      establishmentYear: row?.establishmentYear
        ? String(row.establishmentYear).slice(0, 10)
        : "",
      companyPAN: row?.companyPAN ?? "",
      mainLogoPath: row?.mainLogoPath ?? "",
      companyTAN: row?.companyTAN ?? "",
    });
  }, [form, open, row]);

  const selectedStateId = form.watch("stateId");

  const stateOptions = states.map((state) => ({
    label: state.name,
    value: state.id,
  }));

  const cityOptions = cities
    .filter((city) => !selectedStateId || city.stateId === selectedStateId)
    .map((city) => ({
      label: city.name,
      value: city.id,
    }));

  return (
    <MasterFormDialog<CreateCompanyFormInput, CreateCompanyBody>
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Company" : "Add Company"}
      form={form}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      columns={3}
    >
      <TextField<CreateCompanyFormInput>
        name="name"
        label="Company Name"
        placeholder="Enter company name"
        required
      />

      <TextField<CreateCompanyFormInput>
        name="country"
        label="Country"
        placeholder="Enter country"
        required
      />

      <SelectField<CreateCompanyFormInput>
        name="stateId"
        label="State"
        options={stateOptions}
      />

      <SelectField<CreateCompanyFormInput>
        name="cityId"
        label="City"
        options={cityOptions}
      />

      <PhoneField<CreateCompanyFormInput>
        control={form.control}
        name="contactPhone"
        label="Contact Phone"
      />

     <Controller
  control={form.control}
  name="establishmentYear"
  render={({ field }) => (
    <DatePicker
      label="Establishment Date"
      selected={field.value ? new Date(field.value) : undefined}
      onSelect={(date) =>
        field.onChange(date ? date.toISOString().slice(0, 10) : "")
      }
    />
  )}
/>

      <UppercaseTextField<CreateCompanyFormInput>
        control={form.control}
        name="companyPAN"
        label="Company PAN"
        placeholder="ABCDE1234F"
        maxLength={10}
      />

      <UppercaseTextField<CreateCompanyFormInput>
        control={form.control}
        name="companyTAN"
        label="Company TAN"
        placeholder="ABCD12345E"
        maxLength={10}
      />

      <TextField<CreateCompanyFormInput>
        name="mainLogoPath"
        label="Main Logo Path"
        placeholder="Enter logo path"
      />

      <TextField<CreateCompanyFormInput>
        name="address"
        label="Address"
        placeholder="Enter address"
      />
    </MasterFormDialog>
  );
}