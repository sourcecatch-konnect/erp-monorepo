"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type {
  Pump,
  State,
  City,
  CreatePumpBody,
  CreatePumpFormInput,
} from "@skerp/types";

import {
  IconGasStation,
  IconMapPin,
  IconUser,
  IconPhone,
  IconCash,
  IconBuildingBank,
  IconFileDescription,
} from "@tabler/icons-react";

import { createPumpSchema } from "@skerp/validators";

import MasterFormDialog from "../_shared/MasterFormDialog";
import FormSection from "../_shared/fields/FormSection";
import IconTextField from "../_shared/fields/IconTextField";
import SelectField from "../_shared/fields/SelectField";
import SwitchField from "../_shared/fields/SwitchField";
import TextAreaField from "../_shared/fields/TextAreaField";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: Pump | null;
  states: State[];
  cities: City[];
  onSubmit: (data: CreatePumpBody) => Promise<void>;
  isSubmitting?: boolean;
};

const defaultValues: CreatePumpFormInput = {
  name: "",
  address: "",
  cityId: "",
  stateId: "",
  country: "India",

  contactName: "",
  contactPhone: "",

  gstIn: "",
  pan: "",
  creditLimit: "",

  accountName: "",
  bankName: "",
  branchIfscCode: "",

  currentDieselRate: "",
  isBlackListed: false,
};

export default function PumpAdvancedForm({
  open,
  onOpenChange,
  row,
  states,
  cities,
  onSubmit,
  isSubmitting,
}: Props) {
  const form = useForm<CreatePumpFormInput, unknown, CreatePumpBody>({
    resolver: zodResolver(createPumpSchema),
    mode: "onChange",
    defaultValues,
  });

  React.useEffect(() => {
    if (!open) return;

    form.reset({
      name: row?.name ?? "",
      address: row?.address ?? "",
      cityId: row?.cityId ?? "",
      stateId: row?.stateId ?? "",
      country: row?.country ?? "India",

      contactName: row?.contactName ?? "",
      contactPhone: row?.contactPhone ?? "",

      gstIn: row?.gstIn ?? "",
      pan: row?.pan ?? "",
      creditLimit: row?.creditLimit?.toString() ?? "",

      accountName: row?.accountName ?? "",
      bankName: row?.bankName ?? "",
      branchIfscCode: row?.branchIfscCode ?? "",

      currentDieselRate:
        row?.currentDieselRate != null
          ? String(row.currentDieselRate)
          : "",

      isBlackListed: row?.isBlackListed ?? false,
    });
  }, [form, open, row]);

  const selectedStateId = form.watch("stateId");

  const stateOptions = states.map((s) => ({
    label: s.name,
    value: s.id,
  }));

  const cityOptions = cities
    .filter((c) => !selectedStateId || c.stateId === selectedStateId)
    .map((c) => ({
      label: c.name,
      value: c.id,
    }));

  return (
  <MasterFormDialog<CreatePumpFormInput, CreatePumpBody>
  open={open}
  onOpenChange={onOpenChange}
  title={row ? "Edit Pump" : "Add Pump"}
  form={form}
  onSubmit={onSubmit}
  isSubmitting={isSubmitting}
  columns={3}
>
  <FormSection
    icon={<IconGasStation size={18} />}
    title="Pump Information"
    description="Basic fuel pump and station details"
  >
    <IconTextField<CreatePumpFormInput>
      name="name"
      label="Pump Name"
      placeholder="Enter pump name"
      icon={<IconGasStation size={16} />}
      required
    />

    <div className="md:col-span-2 xl:col-span-3">
      <TextAreaField<CreatePumpFormInput>
        name="address"
        label="Address"
        placeholder="Enter full pump address"
        rows={2}
        maxLength={250}
      />
    </div>
  </FormSection>

  <FormSection
    icon={<IconMapPin size={18} />}
    title="Location Details"
    description="State, city and country information"
  >
    <SelectField<CreatePumpFormInput>
      name="stateId"
      label="State"
      options={stateOptions}
      required
    />

    <SelectField<CreatePumpFormInput>
      name="cityId"
      label="City"
      options={cityOptions}
      required
    />

    <IconTextField<CreatePumpFormInput>
      name="country"
      label="Country"
      placeholder="India"
      icon={<IconMapPin size={16} />}
      required
    />
  </FormSection>

  <FormSection
    icon={<IconUser size={18} />}
    title="Contact Details"
    description="Pump contact person and phone number"
  >
    <IconTextField<CreatePumpFormInput>
      name="contactName"
      label="Contact Person"
      placeholder="Enter contact person"
      icon={<IconUser size={16} />}
    />

    <IconTextField<CreatePumpFormInput>
      name="contactPhone"
      label="Contact Phone"
      placeholder="10-digit phone number"
      icon={<IconPhone size={16} />}
      maxLength={10}
    />
  </FormSection>

  <FormSection
    icon={<IconCash size={18} />}
    title="Fuel & Finance"
    description="Diesel rate and credit limit details"
  >
    <IconTextField<CreatePumpFormInput>
      name="currentDieselRate"
      label="Current Diesel Rate"
      placeholder="0.00"
      icon={<IconCash size={16} />}
      type="number"
      min={0}
      step="0.01"
    />

    <IconTextField<CreatePumpFormInput>
      name="creditLimit"
      label="Credit Limit"
      placeholder="0.00"
      icon={<IconCash size={16} />}
      type="number"
      min={0}
      step="0.01"
    />
  </FormSection>

  <FormSection
    icon={<IconBuildingBank size={18} />}
    title="Bank Details"
    description="Bank account and IFSC information"
  >
    <IconTextField<CreatePumpFormInput>
      name="accountName"
      label="Account Name"
      placeholder="Enter account name"
      icon={<IconBuildingBank size={16} />}
    />

    <IconTextField<CreatePumpFormInput>
      name="bankName"
      label="Bank Name"
      placeholder="Enter bank name"
      icon={<IconBuildingBank size={16} />}
    />

    <IconTextField<CreatePumpFormInput>
      name="branchIfscCode"
      label="IFSC Code"
      placeholder="ABCD0123456"
      icon={<IconBuildingBank size={16} />}
      maxLength={11}
      onChangeTransform={(value) => value.toUpperCase()}
    />
  </FormSection>

  <FormSection
    icon={<IconFileDescription size={18} />}
    title="Tax Details"
    description="GSTIN and PAN details"
  >
    <IconTextField<CreatePumpFormInput>
      name="gstIn"
      label="GSTIN"
      placeholder="27ABCDE1234F1Z5"
      icon={<IconFileDescription size={16} />}
      maxLength={15}
      onChangeTransform={(value) => value.toUpperCase()}
      hint="Format: 27ABCDE1234F1Z5"
    />

    <IconTextField<CreatePumpFormInput>
      name="pan"
      label="PAN"
      placeholder="ABCDE1234F"
      icon={<IconFileDescription size={16} />}
      maxLength={10}
      onChangeTransform={(value) => value.toUpperCase()}
    />
  </FormSection>

  <FormSection
    title="Status"
    icon={<IconGasStation size={18} />}
    description="Control pump transaction availability"
  >
    <SwitchField<CreatePumpFormInput>
      name="isBlackListed"
      label="Blacklisted"
      description="Block this pump from transactions"
      tone="danger"
    />
  </FormSection>
</MasterFormDialog>
  );
}