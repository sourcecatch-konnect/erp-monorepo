"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type {
  Customer,
  State,
  City,
  CreateCustomerBody,
  CreateCustomerFormInput,
} from "@skerp/types";

import { createCustomerSchema } from "@skerp/validators";

import MasterFormDialog from "../_shared/MasterFormDialog";
import TextField from "../_shared/fields/TextField";
import SelectField from "../_shared/fields/SelectField";
import NumberField from "../_shared/fields/NumberField";
import CheckboxField from "../_shared/fields/CheckBoxField";
import UppercaseTextField from "../_shared/fields/UppercaseTextField";
import PhoneField from "../_shared/fields/PhoneField";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: Customer | null;
  states: State[];
  cities: City[];
  onSubmit: (data: CreateCustomerBody) => Promise<void>;
  isSubmitting?: boolean;
};

export default function CustomerForm({
  open,
  onOpenChange,
  row,
  states,
  cities,
  onSubmit,
  isSubmitting,
}: Props) {
  const form = useForm<
    CreateCustomerFormInput,
    unknown,
    CreateCustomerBody
  >({
    resolver: zodResolver(createCustomerSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      name: "",
      shortName: "",
      customerPAN: "",
      disallowNewLRBooking: false,
      interestRateLatePayment: "",
      gstNo: "",
      creditLimit: "",
      tdsDeductionRate: "",
      address: "",
      country: "India",
      stateId: "",
      cityId: "",
      contactPhone: "",
      primaryEmail: "",
      contactPerson: "",
      mobileNo: "",
      website: "",
    },
  });

  React.useEffect(() => {
    if (!open) return;

    form.reset({
      name: row?.name ?? "",
      shortName: row?.shortName ?? "",
      customerPAN: row?.customerPAN ?? "",
      disallowNewLRBooking: row?.disallowNewLRBooking ?? false,
      interestRateLatePayment:
        row?.interestRateLatePayment != null
          ? String(row.interestRateLatePayment)
          : "",
      gstNo: row?.gstNo ?? "",
      creditLimit:
        row?.creditLimit != null ? String(row.creditLimit) : "",
      tdsDeductionRate:
        row?.tdsDeductionRate != null
          ? String(row.tdsDeductionRate)
          : "",
      address: row?.address ?? "",
      country: row?.country ?? "India",
      stateId: row?.stateId ?? "",
      cityId: row?.cityId ?? "",
      contactPhone: row?.contactPhone ?? "",
      primaryEmail: row?.primaryEmail ?? "",
      contactPerson: row?.contactPerson ?? "",
      mobileNo: row?.mobileNo ?? "",
      website: row?.website ?? "",
    });
  }, [form, open, row]);

  const stateOptions = states.map((state) => ({
    label: state.name,
    value: state.id,
  }));

  const selectedStateId = form.watch("stateId");

  const cityOptions = cities
    .filter((city) => !selectedStateId || city.stateId === selectedStateId)
    .map((city) => ({
      label: city.name,
      value: city.id,
    }));

  return (
    <MasterFormDialog<CreateCustomerFormInput, CreateCustomerBody>
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Customer" : "Add Customer"}
      form={form}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      columns={3}
    >
      <TextField<CreateCustomerFormInput>
        name="name"
        label="Customer Name"
        placeholder="Enter customer name"
        required
      />

      <TextField<CreateCustomerFormInput>
        name="shortName"
        label="Short Name"
        placeholder="Enter short name"
      />

     <UppercaseTextField<CreateCustomerFormInput>
            control={form.control}
            name="customerPAN"
            label="PAN No"
            placeholder="ABCDE1234F"
            maxLength={10}
          />
    
          <UppercaseTextField<CreateCustomerFormInput>
            control={form.control}
            name="gstNo"
            label="GSTIN"
            placeholder="27ABCDE1234F1Z5"
            maxLength={15}
          />
      <NumberField<CreateCustomerFormInput>
        control={form.control}
        name="creditLimit"
        label="Credit Limit"
        placeholder="Enter credit limit"
        min={0}
        step="0.01"
      />

      <NumberField<CreateCustomerFormInput>
        control={form.control}
        name="interestRateLatePayment"
        label="Late Payment Interest %"
        placeholder="Enter interest rate"
        min={0}
        max={100}
        step="0.01"
      />

      <NumberField<CreateCustomerFormInput>
        control={form.control}
        name="tdsDeductionRate"
        label="TDS Deduction %"
        placeholder="Enter TDS rate"
        min={0}
        max={100}
        step="0.01"
      />

      <TextField<CreateCustomerFormInput>
        name="country"
        label="Country"
        placeholder="Enter country"
        required
      />

      <SelectField<CreateCustomerFormInput>
        name="stateId"
        label="State"
        options={stateOptions}
        required
      />

      <SelectField<CreateCustomerFormInput>
        name="cityId"
        label="City"
        options={cityOptions}
        required
      />

      <TextField<CreateCustomerFormInput>
        name="address"
        label="Address"
        placeholder="Enter address"
      />

      <TextField<CreateCustomerFormInput>
        name="contactPerson"
        label="Contact Person"
        placeholder="Enter contact person"
      />

    <PhoneField<CreateCustomerFormInput>
  control={form.control}
  name="contactPhone"
  label="Contact Phone"
  required
/>
      <PhoneField<CreateCustomerFormInput>
  control={form.control}
  name="mobileNo"
  label="Mobile No"
/>
      <TextField<CreateCustomerFormInput>
        name="primaryEmail"
        label="Primary Email"
        placeholder="Enter email"
      />

      <TextField<CreateCustomerFormInput>
        name="website"
        label="Website"
        placeholder="https://example.com"
      />

      <CheckboxField<CreateCustomerFormInput>
        name="disallowNewLRBooking"
        label="Disallow New LR Booking"
      />
    </MasterFormDialog>
  );
}