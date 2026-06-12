"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type {
  CreateDriverBody,
  CreateDriverFormInput,
  Driver,
} from "@skerp/types";
import {
  IconBan,
  IconBeach,
  IconCurrencyRupee,
  IconDeviceLandlinePhone,
  IconHome,
  IconId,
  IconIdBadge2,
  IconLicense,
  IconMail,
  IconMapPin,
  IconNotes,
  IconPercentage,
  IconUser,
  IconUserCheck,
  IconUserStar,
} from "@tabler/icons-react";


import MasterFormDialog from "../_shared/MasterFormDialog";
import SelectField from "../_shared/fields/SelectField";
import IconTextField from "../_shared/fields/IconTextField";
import TextAreaField from "../_shared/fields/TextAreaField";
import SwitchField from "../_shared/fields/SwitchField";
import FormSection from "../_shared/fields/FormSection";
import { createDriverSchema } from "@skerp/validators";
import { DatePicker } from "@skerp/ui/components/datepicker";
import { paiseToRupees } from "@/lib/money";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: Driver | null;
  onSubmit: (data: CreateDriverBody) => Promise<void>;
  isSubmitting?: boolean;
};

const driverStatusOptions = [
  { label: "Available", value: "AVAILABLE" },
  { label: "On Trip", value: "ON_TRIP" },
];

const driverTypeOptions = [
  { label: "Permanent", value: "Permanent" },
  { label: "Contract", value: "Contract" },
  { label: "Owner Driver", value: "Owner" },
];

const bloodGroupOptions = [
  { label: "A+", value: "A+" },
  { label: "A-", value: "A-" },
  { label: "B+", value: "B+" },
  { label: "B-", value: "B-" },
  { label: "AB+", value: "AB+" },
  { label: "AB-", value: "AB-" },
  { label: "O+", value: "O+" },
  { label: "O-", value: "O-" },
];

const toDateInput = (value?: string | null) => {
  if (!value) return "";

  return value.slice(0, 10);
};

const defaultValues: CreateDriverFormInput = {
  name: "",
  photoPath: "",
  status: "AVAILABLE",
  type: "Permanent",
  birthDate: "",
  anniversaryDate: "",
  mobile: "",
  alternateMobile: "",
  licenseNo: "",
  licenseDate: "",
  licenseExpiryDate: "",
  licenseCity: "",
  permanentAddress: "",
  permanentCountry: "India",
  permanentState: "",
  permanentCity: "",
  correspondenceAddress: "",
  correspondenceCountry: "India",
  correspondenceState: "",
  correspondenceCity: "",
  correspondenceLandline: "",
  referencePerson: "",
  referenceContactNo: "",
  bloodGroup: "",
  otherDetails: "",
  salary: "",
  panNo: "",
  aadharCardNo: "",
  noTDSApplyAmount: "",
  tdsRate: "",
  onLeave: false,
  blackListed: false,
};

export default function DriverForm({
  open,
  onOpenChange,
  row,
  onSubmit,
  isSubmitting,
}: Props) {
  const form = useForm<CreateDriverFormInput, unknown, CreateDriverBody>({
    resolver: zodResolver(createDriverSchema),
    defaultValues,
  });

  const [copyAddress, setCopyAddress] = React.useState(false);
  const [hasReference, setHasReference] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;

    form.reset({
      name: row?.name ?? "",
      photoPath: row?.photoPath ?? "",
      status: row?.status ?? "AVAILABLE",
      type: row?.type ?? "Permanent",
      birthDate: toDateInput(row?.birthDate),
      anniversaryDate: toDateInput(row?.anniversaryDate),
      mobile: row?.mobile ?? "",
      alternateMobile: row?.alternateMobile ?? "",
      licenseNo: row?.licenseNo ?? "",
      licenseDate: toDateInput(row?.licenseDate),
      licenseExpiryDate: toDateInput(row?.licenseExpiryDate),
      licenseCity: row?.licenseCity ?? "",
      permanentAddress: row?.permanentAddress ?? "",
      permanentCountry: row?.permanentCountry ?? "India",
      permanentState: row?.permanentState ?? "",
      permanentCity: row?.permanentCity ?? "",
      correspondenceAddress: row?.correspondenceAddress ?? "",
      correspondenceCountry: row?.correspondenceCountry ?? "India",
      correspondenceState: row?.correspondenceState ?? "",
      correspondenceCity: row?.correspondenceCity ?? "",
      correspondenceLandline: row?.correspondenceLandline ?? "",
      referencePerson: row?.referencePerson ?? "",
      referenceContactNo: row?.referenceContactNo ?? "",
      bloodGroup: row?.bloodGroup ?? "",
      otherDetails: row?.otherDetails ?? "",
      salary: row?.salary != null ? String(paiseToRupees(row.salary)) : "",
      panNo: row?.panNo ?? "",
      aadharCardNo: row?.aadharCardNo ?? "",
      noTDSApplyAmount:
        row?.noTDSApplyAmount != null
          ? String(paiseToRupees(row.noTDSApplyAmount))
          : "",
      tdsRate: row?.tdsRate != null ? String(row.tdsRate) : "",
      onLeave: row?.onLeave ?? false,
      blackListed: row?.blackListed ?? false,
    });

    setCopyAddress(false);
    setHasReference(Boolean(row?.referencePerson || row?.referenceContactNo));
  }, [form, open, row]);

  const handleCopyAddressToggle = (checked: boolean) => {
    setCopyAddress(checked);

    if (checked) {
      form.setValue(
        "correspondenceAddress",
        form.getValues("permanentAddress") ?? "",
      );
      form.setValue(
        "correspondenceCountry",
        form.getValues("permanentCountry") ?? "",
      );
      form.setValue(
        "correspondenceState",
        form.getValues("permanentState") ?? "",
      );
      form.setValue(
        "correspondenceCity",
        form.getValues("permanentCity") ?? "",
      );
    }
  };

  const handleHasReferenceToggle = (checked: boolean) => {
    setHasReference(checked);

    if (!checked) {
      form.setValue("referencePerson", "");
      form.setValue("referenceContactNo", "");
    }
  };

  return (
    <MasterFormDialog<CreateDriverFormInput, CreateDriverBody>
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Driver" : "Add Driver"}
      form={form}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      columns={3}
    >
      <FormSection
        icon={<IconUser size={18} />}
        title="Personal Information"
        description="Basic identity and contact details"
      >
        <IconTextField<CreateDriverFormInput>
          name="name"
          label="Full Name"
          placeholder="e.g. Ramesh Kumar"
          icon={<IconUser size={16} />}
          required
        />

        <SelectField<CreateDriverFormInput>
          name="type"
          label="Driver Type"
          options={driverTypeOptions}
          required
        />

        <SelectField<CreateDriverFormInput>
          name="bloodGroup"
          label="Blood Group"
          placeholder="Select blood group"
          options={bloodGroupOptions}
        />

        <IconTextField<CreateDriverFormInput>
          name="mobile"
          label="Primary Mobile"
          placeholder="10-digit mobile"
          prefix="+91"
          required
          maxLength={10}
          hint="Used for trip & emergency contact"
        />

        <IconTextField<CreateDriverFormInput>
          name="alternateMobile"
          label="Alternate Mobile"
          placeholder="10-digit mobile"
          prefix="+91"
          maxLength={10}
        />

        <Controller
          control={form.control}
          name="birthDate"
          render={({ field, fieldState }) => (
            <div className="grid gap-1.5">
              <DatePicker
                label="Date of Birth"
                selected={field.value ? new Date(field.value) : undefined}
                onSelect={(date) =>
                  field.onChange(date ? date.toISOString().slice(0, 10) : "")
                }
              />
              {fieldState.error?.message ? (
                <p className="text-xs text-red-600">
                  {fieldState.error.message}
                </p>
              ) : null}
            </div>
          )}
        />

        <Controller
          control={form.control}
          name="anniversaryDate"
          render={({ field }) => (
            <DatePicker
              label="Anniversary Date"
              selected={field.value ? new Date(field.value) : undefined}
              onSelect={(date) =>
                field.onChange(date ? date.toISOString().slice(0, 10) : "")
              }
            />
          )}
        />
      </FormSection>

      <FormSection
        icon={<IconLicense size={18} />}
        title="Driving License"
        description="License details and validity"
      >
        <IconTextField<CreateDriverFormInput>
          name="licenseNo"
          label="License Number"
          placeholder="e.g. MH1420110012345"
          icon={<IconLicense size={16} />}
          required
          maxLength={20}
        />

        <IconTextField<CreateDriverFormInput>
          name="licenseCity"
          label="Issuing City / RTO"
          placeholder="e.g. Pune"
          icon={<IconMapPin size={16} />}
        />

        <Controller
          control={form.control}
          name="licenseDate"
          render={({ field }) => (
            <DatePicker
              label="License Issue Date"
              selected={field.value ? new Date(field.value) : undefined}
              onSelect={(date) =>
                field.onChange(date ? date.toISOString().slice(0, 10) : "")
              }
            />
          )}
        />

        <Controller
          control={form.control}
          name="licenseExpiryDate"
          render={({ field, fieldState }) => (
            <div className="grid gap-1.5">
              <DatePicker
                label="License Expiry Date"
                selected={field.value ? new Date(field.value) : undefined}
                onSelect={(date) =>
                  field.onChange(date ? date.toISOString().slice(0, 10) : "")
                }
              />
              {fieldState.error?.message ? (
                <p className="text-xs text-red-600">
                  {fieldState.error.message}
                </p>
              ) : null}
            </div>
          )}
        />
      </FormSection>

      <FormSection
        icon={<IconHome size={18} />}
        title="Permanent Address"
        description="Where the driver is permanently based"
      >
        <div className="md:col-span-2 xl:col-span-3">
          <TextAreaField<CreateDriverFormInput>
            name="permanentAddress"
            label="Address Line"
            placeholder="House / Street / Locality"
            maxLength={250}
            rows={2}
          />
        </div>

        <IconTextField<CreateDriverFormInput>
          name="permanentCountry"
          label="Country"
          icon={<IconMapPin size={16} />}
        />

        <IconTextField<CreateDriverFormInput>
          name="permanentState"
          label="State"
          icon={<IconMapPin size={16} />}
        />

        <IconTextField<CreateDriverFormInput>
          name="permanentCity"
          label="City"
          icon={<IconMapPin size={16} />}
        />
      </FormSection>

      <FormSection
        icon={<IconMail size={18} />}
        title="Correspondence Address"
        description="Where official communication is sent"
      >
        <label className="col-span-full flex cursor-pointer items-center gap-2 rounded-md border border-dashed bg-card px-3 py-2 text-xs font-medium text-muted-foreground">
          <input
            type="checkbox"
            className="size-3.5 accent-primary"
            checked={copyAddress}
            onChange={(event) => handleCopyAddressToggle(event.target.checked)}
          />
          Same as permanent address
        </label>

        {copyAddress ? (
          <p className="col-span-full text-xs text-muted-foreground">
            Correspondence address will use the permanent address values.
          </p>
        ) : (
          <>
            <div className="md:col-span-2 xl:col-span-3">
              <TextAreaField<CreateDriverFormInput>
                name="correspondenceAddress"
                label="Address Line"
                placeholder="House / Street / Locality"
                maxLength={250}
                rows={2}
              />
            </div>

            <IconTextField<CreateDriverFormInput>
              name="correspondenceCountry"
              label="Country"
              icon={<IconMapPin size={16} />}
            />

            <IconTextField<CreateDriverFormInput>
              name="correspondenceState"
              label="State"
              icon={<IconMapPin size={16} />}
            />

            <IconTextField<CreateDriverFormInput>
              name="correspondenceCity"
              label="City"
              icon={<IconMapPin size={16} />}
            />

            <IconTextField<CreateDriverFormInput>
              name="correspondenceLandline"
              label="Landline"
              placeholder="e.g. 020-1234567"
              icon={<IconDeviceLandlinePhone size={16} />}
            />
          </>
        )}
      </FormSection>

      <FormSection
        icon={<IconUserStar size={18} />}
        title="Reference"
        description="Anyone who referred this driver?"
      >
        <label className="col-span-full flex cursor-pointer items-center gap-2 rounded-md border border-dashed bg-card px-3 py-2 text-xs font-medium text-muted-foreground">
          <input
            type="checkbox"
            className="size-3.5 accent-primary"
            checked={hasReference}
            onChange={(event) => handleHasReferenceToggle(event.target.checked)}
          />
          Yes, a reference person referred this driver
        </label>

        {hasReference ? (
          <>
            <IconTextField<CreateDriverFormInput>
              name="referencePerson"
              label="Reference Person"
              placeholder="Full name"
              icon={<IconUser size={16} />}
            />

            <IconTextField<CreateDriverFormInput>
              name="referenceContactNo"
              label="Reference Contact"
              placeholder="10-digit mobile"
              prefix="+91"
              maxLength={10}
            />
          </>
        ) : null}
      </FormSection>

      <FormSection
        icon={<IconId size={18} />}
        title="Identification & Payroll"
        description="PAN, Aadhar, salary and TDS settings"
      >
        <IconTextField<CreateDriverFormInput>
          name="panNo"
          label="PAN Number"
          placeholder="ABCDE1234F"
          icon={<IconIdBadge2 size={16} />}
          maxLength={10}
          hint="10-character PAN"
        />

        <IconTextField<CreateDriverFormInput>
          name="aadharCardNo"
          label="Aadhar Number"
          placeholder="12-digit Aadhar"
          icon={<IconId size={16} />}
          maxLength={12}
        />

        <IconTextField<CreateDriverFormInput>
          name="salary"
          label="Monthly Salary"
          placeholder="0.00"
          icon={<IconCurrencyRupee size={16} />}
          type="number"
        />

        <IconTextField<CreateDriverFormInput>
          name="noTDSApplyAmount"
          label="No-TDS Threshold"
          placeholder="0.00"
          icon={<IconCurrencyRupee size={16} />}
          type="number"
          hint="Skip TDS below this amount"
        />

        <IconTextField<CreateDriverFormInput>
          name="tdsRate"
          label="TDS Rate"
          placeholder="0"
          icon={<IconPercentage size={16} />}
          type="number"
          hint="In percentage (0-100)"
        />
      </FormSection>

      <FormSection
        icon={<IconUserCheck size={18} />}
        title="Status & Flags"
        description="Operational state and access flags"
      >
        <SelectField<CreateDriverFormInput>
          name="status"
          label="Driver Status"
          options={driverStatusOptions}
          required
        />

        <SwitchField<CreateDriverFormInput>
          name="onLeave"
          label="On Leave"
          description="Temporarily unavailable"
          icon={<IconBeach size={16} />}
          tone="warning"
        />

        <SwitchField<CreateDriverFormInput>
          name="blackListed"
          label="Blacklisted"
          description="Block from new assignments"
          icon={<IconBan size={16} />}
          tone="danger"
        />
      </FormSection>

      <FormSection
        icon={<IconNotes size={18} />}
        title="Other Details"
        columns={1}
      >
        <TextAreaField<CreateDriverFormInput>
          name="otherDetails"
          label="Notes"
          placeholder="Any additional information about the driver..."
          rows={3}
          maxLength={500}
        />
      </FormSection>
    </MasterFormDialog>
  );
}
