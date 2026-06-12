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

import {
  IconBuildingStore,
  IconCash,
  IconFileDescription,
  IconMapPin,
  IconPhone,
  IconUser,
} from "@tabler/icons-react";

import { createCustomerSchema } from "@skerp/validators";
import { paiseToRupees } from "@/lib/money";
import MasterFormDialog from "../_shared/MasterFormDialog";
import FormSection from "../_shared/fields/FormSection";
import IconTextField from "../_shared/fields/IconTextField";
import SelectField from "../_shared/fields/SelectField";
import TextAreaField from "../_shared/fields/TextAreaField";
import SwitchField from "../_shared/fields/SwitchField";
import CustomerLocationsEditor from "./CustomerLocationsEditor";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: Customer | null;
  states: State[];
  cities: City[];
  onSubmit: (data: CreateCustomerBody) => Promise<void>;
  isSubmitting?: boolean;
};

const defaultValues: CreateCustomerFormInput = {
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
};

export default function CustomerAdvancedForm({
  open,
  onOpenChange,
  row,
  states,
  cities,
  onSubmit,
  isSubmitting,
}: Props) {
  const form = useForm<CreateCustomerFormInput, unknown, CreateCustomerBody>({
    resolver: zodResolver(createCustomerSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues,
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
      creditLimit: row?.creditLimit != null ? String(paiseToRupees(row.creditLimit)) : "",
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
    <MasterFormDialog<CreateCustomerFormInput, CreateCustomerBody>
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Customer" : "Add Customer"}
      form={form}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      columns={3}
    >
      <FormSection
        icon={<IconBuildingStore size={18} />}
        title="Customer Information"
        description="Basic customer and business details"
      >
        <IconTextField<CreateCustomerFormInput>
          name="name"
          label="Customer Name"
          placeholder="Enter customer name"
          icon={<IconBuildingStore size={16} />}
          required
        />

        <IconTextField<CreateCustomerFormInput>
          name="shortName"
          label="Short Name"
          placeholder="Enter short name"
          icon={<IconFileDescription size={16} />}
        />

        <IconTextField<CreateCustomerFormInput>
          name="customerPAN"
          label="PAN No"
          placeholder="ABCDE1234F"
          icon={<IconFileDescription size={16} />}
          maxLength={10}
          onChangeTransform={(value) => value.toUpperCase()}
        />
  
        <IconTextField<CreateCustomerFormInput>
          name="gstNo"
          label="GSTIN"
          placeholder="27ABCDE1234F1Z5"
          icon={<IconFileDescription size={16} />}
          maxLength={15}
          onChangeTransform={(value) => value.toUpperCase()}
          hint="Format: 27ABCDE1234F1Z5"
        />

        <IconTextField<CreateCustomerFormInput>
          name="website"
          label="Website"
          placeholder="https://example.com"
          icon={<IconFileDescription size={16} />}
        />
      </FormSection>

      <FormSection
        icon={<IconCash size={18} />}
        title="Finance Settings"
        description="Credit, interest and TDS information"
      >
        <IconTextField<CreateCustomerFormInput>
  name="creditLimit"
  label="Credit Limit"
  placeholder="0.00"
  icon={<IconCash size={16} />}
  type="number"
  min={0}
  step="0.01"
/>
      <IconTextField<CreateCustomerFormInput>
  name="interestRateLatePayment"
  label="Late Payment Interest %"
  placeholder="0"
  icon={<IconCash size={16} />}
  type="number"
  min={0}
  max={100}
  step="0.01"
/>

   <IconTextField<CreateCustomerFormInput>
  name="tdsDeductionRate"
  label="TDS Deduction %"
  placeholder="0"
  icon={<IconCash size={16} />}
  type="number"
  min={0}
  max={100}
  step="0.01"
/>
        <SwitchField<CreateCustomerFormInput>
          name="disallowNewLRBooking"
          label="Disallow New LR Booking"
          description="Block new LR bookings for this customer"
          tone="danger"
        />
      </FormSection>

      <FormSection
        icon={<IconMapPin size={18} />}
        title="Address Details"
        description="Location and billing address"
      >
        <IconTextField<CreateCustomerFormInput>
          name="country"
          label="Country"
          placeholder="India"
          icon={<IconMapPin size={16} />}
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

        <div className="md:col-span-2 xl:col-span-3">
          <TextAreaField<CreateCustomerFormInput>
            name="address"
            label="Address"
            placeholder="Enter full address"
            rows={2}
            maxLength={250}
          />
        </div>
      </FormSection>

      <FormSection
        icon={<IconUser size={18} />}
        title="Contact Details"
        description="Primary contact and communication details"
      >
        <IconTextField<CreateCustomerFormInput>
          name="contactPerson"
          label="Contact Person"
          placeholder="Enter contact person"
          icon={<IconUser size={16} />}
        />

        <IconTextField<CreateCustomerFormInput>
          name="contactPhone"
          label="Contact Phone"
          placeholder="10-digit phone"
          icon={<IconPhone size={16} />}
          maxLength={10}
        />

        <IconTextField<CreateCustomerFormInput>
          name="mobileNo"
          label="Mobile No"
          placeholder="10-digit mobile"
          icon={<IconPhone size={16} />}
          maxLength={10}
        />

        <IconTextField<CreateCustomerFormInput>
          name="primaryEmail"
          label="Primary Email"
          placeholder="Enter email"
          icon={<IconFileDescription size={16} />}
        />
      </FormSection>

      {row?.id ? (
        <FormSection
          icon={<IconMapPin size={18} />}
          title="Pickup Locations"
          description="Saved pickup points used when booking orders"
        >
          <CustomerLocationsEditor customerId={row.id} cities={cities} />
        </FormSection>
      ) : null}
    </MasterFormDialog>
  );
}
