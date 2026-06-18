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
  IconPercentage,
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
import { useQuery } from "@tanstack/react-query";
import { stateKeys } from "../state/state.keys";
import { stateApi } from "../state/state.service";

import { useMasterMutations } from "../_shared/hooks/useMasterMutation";
import { customerApi } from "./customer.service";
import { customerKeys } from "./customer.key";
import CitySelectField from "../_shared/fields/CitySelectField";
import { cityKeys } from "../city/city.keys";
import { cityApi } from "../city/city.service";
import { usePrefillCustomer } from "@/features/dev-tools/usePrefillCustomer";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: Customer | null;
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

}: Props) {
  const form = useForm<CreateCustomerFormInput, unknown, CreateCustomerBody>({
    resolver: zodResolver(createCustomerSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues,
  });
const states = useQuery({
  queryKey: stateKeys.list({ page: 0, size: 1000 }),
  queryFn: () => stateApi.list({ page: 0, size: 1000 }),
  enabled: open,
});

const { create, update } = useMasterMutations({
  api: customerApi,
  queryKey: customerKeys.all,
  entityName: "Customer",
});

const handleSubmit = async (data: CreateCustomerBody) => {
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
    previousStateIdRef.current = row?.stateId ?? "";
  }, [form, open, row]);
  const cities = useQuery({
  queryKey: cityKeys.list({ page: 0, size: 1000 }),
  queryFn: () => cityApi.list({ page: 0, size: 1000 }),
  enabled: open && Boolean(row?.id),
});
const stateOptions = (states.data?.data ?? []).map((state) => ({
  label: state.name,
  value: state.id,
}));

  const prefillCustomer = usePrefillCustomer({ states, cities });

  const selectedStateId = form.watch("stateId");
const previousStateIdRef = React.useRef<string>("");

React.useEffect(() => {
  if (!open) return;

  const previousStateId = previousStateIdRef.current;

  if (previousStateId && previousStateId !== selectedStateId) {
    form.setValue("cityId", "", {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  previousStateIdRef.current = selectedStateId;
}, [form, open, selectedStateId]);




  return (
    <MasterFormDialog<CreateCustomerFormInput, CreateCustomerBody>
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Customer" : "Add Customer"}
      form={form}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      columns={3}
      footerLeft={
        prefillCustomer ? (
          <button
            type="button"
            onClick={() => form.reset(prefillCustomer())}
            className="flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 4-1 1"/><path d="m4 15 1-1"/><path d="m10.5 6.5-5 5"/><path d="M6 6l12 12"/><path d="m18 6-1.5 1.5"/><path d="m8.5 18-1 1"/></svg>
            Fill Test Data
          </button>
        ) : undefined
      }
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

  required
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
  label="Late Payment Interest"
  placeholder="e.g. 18"
  icon={<IconPercentage size={16} />}
  suffix="%"
  type="number"
  min={0}
  max={100}
  step="0.01"
/>

  <IconTextField<CreateCustomerFormInput>
  name="tdsDeductionRate"
  label="TDS Deduction"
  placeholder="e.g. 2"
  icon={<IconPercentage size={16} />}
  suffix="%"
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

      <CitySelectField<CreateCustomerFormInput>
  name="cityId"
  label="City"
  required
  disabled={!selectedStateId}
  stateId={selectedStateId}
  placeholder={selectedStateId ? "Select city" : "Select state first"}
  initialCity={
    row?.city
      ? {
          id: row.city.id,
          name: row.city.name,
        }
      : null
  }
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
          required
        />

        <IconTextField<CreateCustomerFormInput>
          name="contactPhone"
          label="Contact Phone"
          placeholder="10-digit phone"
          icon={<IconPhone size={16} />}
          maxLength={10}
          required
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
          <CustomerLocationsEditor customerId={row.id} cities={cities.data?.data ?? []} />
        </FormSection>
      ) : null}

    </MasterFormDialog>
  );
}
