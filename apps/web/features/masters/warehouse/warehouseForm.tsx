"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type {
  Warehouse,

  CreateWarehouseBody,
  CreateWarehouseFormInput,
} from "@skerp/types";

import {
  IconArrowsHorizontal,
  IconArrowsVertical,
  IconBoxSeam,
  IconBuildingWarehouse,
  IconCalendarEvent,
  IconCurrencyRupee,
  IconMapPin,
  IconPhone,
  IconRulerMeasure,
  IconUser,
} from "@tabler/icons-react";

import { createWarehouseSchema } from "@skerp/validators";
import { paiseToRupees } from "@/lib/money";
import MasterFormDialog from "../_shared/MasterFormDialog";
import SelectField from "../_shared/fields/SelectField";
import IconTextField from "../_shared/fields/IconTextField";
import FormSection from "../_shared/fields/FormSection";
import TextAreaField from "../_shared/fields/TextAreaField";
import { DatePicker } from "@skerp/ui/components/datepicker";
import { useQuery } from "@tanstack/react-query";
import { stateApi } from "../state/state.service";
import { stateKeys } from "../state/state.keys";
import { branchKeys } from "../branch/branch.key";
import { branchApi } from "../branch/branch.service";
import { warehouseApi } from "./warehouse.service";
import { warehouseKeys } from "./warehouse.key";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";
import CitySelectField from "../_shared/fields/CitySelectField";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: Warehouse | null;

};

const defaultValues: CreateWarehouseFormInput = {
  name: "",
  type: "",
  address: "",
  country: "India",
  stateId: "",
  cityId: "",
  branchId: "",
  contactName: "",
  contactPhone: "",
  monthlyRent: undefined,
  securityDeposit: undefined,
  length: undefined,
  width: undefined,
  breadth: undefined,
  gateNo: "",
  agreementDate: "",
expiryDate: "",
  storageCapacity: undefined,
};

export default function WarehouseForm({
  open,
  onOpenChange,
  row,

}: Props) {
  const form = useForm<CreateWarehouseFormInput, unknown, CreateWarehouseBody>({
    resolver: zodResolver(createWarehouseSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues,
  });
const statesQuery = useQuery({
  queryKey: stateKeys.list({ page: 0, size: 35 }),
  queryFn: () => stateApi.list({ page: 0, size: 35 }),
  enabled: open,
});



const branchesQuery = useQuery({
  queryKey: branchKeys.list({ page: 0, size: 100 }),
  queryFn: () => branchApi.list({ page: 0, size: 100 }),
  enabled: open,
});

const { create, update } = useMasterMutations({
  api: warehouseApi,
  queryKey: warehouseKeys.all,
});

const handleSubmit = async (data: CreateWarehouseBody) => {
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
      type: row?.type ?? "",
      address: row?.address ?? "",
      country: row?.country ?? "India",
      stateId: row?.stateId ?? "",
      cityId: row?.cityId ?? "",
      branchId: row?.branchId ?? "",
      contactName: row?.contactName ?? "",
      contactPhone: row?.contactPhone ?? "",
      monthlyRent:
        row?.monthlyRent != null ? paiseToRupees(row.monthlyRent) : undefined,
      securityDeposit:
        row?.securityDeposit != null ? paiseToRupees(row.securityDeposit) : undefined,
      length: row?.length ?? undefined,
      width: row?.width ?? undefined,
      breadth: row?.breadth ?? undefined,
      gateNo: row?.gateNo ?? "",
      storageCapacity: row?.storageCapacity ?? undefined,
      agreementDate: row?.agreementDate
  ? new Date(row.agreementDate).toISOString().slice(0, 10)
  : "",

expiryDate: row?.expiryDate
  ? new Date(row.expiryDate).toISOString().slice(0, 10)
  : "",
    });
    previousStateIdRef.current = row?.stateId ?? "";
  }, [form, open, row]);
const selectedStateId = form.watch("stateId") ?? "";

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
const stateOptions = (statesQuery.data?.data ?? []).map((state) => ({
  label: state.name,
  value: state.id,
}));

const branchOptions = (branchesQuery.data?.data ?? []).map((branch) => ({
  label: branch.name,
  value: branch.id,
}));
  return (
    <MasterFormDialog<CreateWarehouseFormInput, CreateWarehouseBody>
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Warehouse" : "Add Warehouse"}
      form={form}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      columns={3}
    >
      <FormSection
        icon={<IconBuildingWarehouse size={18} />}
        title="Warehouse Information"
        description="Basic warehouse identity and type"
      >
        <IconTextField<CreateWarehouseFormInput>
          name="name"
          label="Warehouse Name"
          placeholder="Enter warehouse name"
          icon={<IconBuildingWarehouse size={16} />}
          required
        />

        <IconTextField<CreateWarehouseFormInput>
          name="type"
          label="Warehouse Type"
          placeholder="Enter warehouse type"
          icon={<IconBuildingWarehouse size={16} />}
          required
        />

        <SelectField<CreateWarehouseFormInput>
          name="branchId"
          label="Branch"
          options={branchOptions}
          required
        />

       <IconTextField<CreateWarehouseFormInput>
  name="gateNo"
  label="Gate / Dock No."
  placeholder="e.g. Gate 1, Dock 2, Main Gate"
  icon={<IconBuildingWarehouse size={16} />}
/>
      </FormSection>

      <FormSection
        icon={<IconMapPin size={18} />}
        title="Location Details"
        description="Warehouse address and location"
      >
        <IconTextField<CreateWarehouseFormInput>
          name="country"
          label="Country"
          placeholder="Enter country"
          icon={<IconMapPin size={16} />}
          required
        />

        <SelectField<CreateWarehouseFormInput>
          name="stateId"
          label="State"
          options={stateOptions}
          required
        />

        <CitySelectField<CreateWarehouseFormInput>
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
          <TextAreaField<CreateWarehouseFormInput>
            name="address"
            label="Address"
            placeholder="Enter warehouse address"
            rows={2}
            maxLength={250}
          />
        </div>
      </FormSection>

      <FormSection
        icon={<IconPhone size={18} />}
        title="Contact Details"
        description="Warehouse contact person and phone"
      >
        <IconTextField<CreateWarehouseFormInput>
          name="contactName"
          label="Contact Person"
          placeholder="Enter contact person"
          icon={<IconUser size={16} />}
        />

        <IconTextField<CreateWarehouseFormInput>
          name="contactPhone"
          label="Contact Phone"
          placeholder="10-digit phone"
          maxLength={10}
          icon={<IconPhone size={16} />}
        />
      </FormSection>

      <FormSection
        icon={<IconCurrencyRupee size={18} />}
        title="Rent & Deposit"
        description="Warehouse financial details"
      >
        <IconTextField<CreateWarehouseFormInput>
          name="monthlyRent"
          label="Monthly Rent"
         placeholder="20,000"
          icon={<IconCurrencyRupee size={16} />}
          type="number"
        />

        <IconTextField<CreateWarehouseFormInput>
          name="securityDeposit"
          label="Security Deposit"
         placeholder="60,000"
          icon={<IconCurrencyRupee size={16} />}
          type="number"
        />
      </FormSection>
    <FormSection
  icon={<IconCalendarEvent size={18} />}
 title="Rent Agreement Period"
description="Warehouse rent start and expiry details"
>
  <Controller
    control={form.control}
    name="agreementDate"
    render={({ field }) => (
      <DatePicker
       label="Rent Start Date"
        selected={field.value ? new Date(field.value) : undefined}
        onSelect={(date) =>
          field.onChange(date ? date.toISOString().slice(0, 10) : "")
        }
      />
    )}
  />

  <Controller
    control={form.control}
    name="expiryDate"
    render={({ field }) => (
      <DatePicker
       label="Rent Expire Date"
        selected={field.value ? new Date(field.value) : undefined}
        onSelect={(date) =>
          field.onChange(date ? date.toISOString().slice(0, 10) : "")
        }
      />
    )}
  />
  </FormSection>
<FormSection
  icon={<IconRulerMeasure size={18} />}
  title="Dimensions & Capacity"
  description="Enter warehouse dimensions in feet and capacity in cubic feet"
>
  <IconTextField<CreateWarehouseFormInput>
    name="length"
    label="Length"
    placeholder="100"
    icon={<IconRulerMeasure size={16} />}
    type="number"
    suffix="ft"
  />

  <IconTextField<CreateWarehouseFormInput>
    name="width"
    label="Width"
    placeholder="60"
    icon={<IconArrowsHorizontal size={16} />}
    type="number"
    suffix="ft"
  />

  <IconTextField<CreateWarehouseFormInput>
    name="breadth"
    label="Height"
    placeholder="20"
    icon={<IconArrowsVertical size={16} />}
    type="number"
    suffix="ft"
  />

  <IconTextField<CreateWarehouseFormInput>
    name="storageCapacity"
    label="Storage Capacity"
    placeholder="120000"
    icon={<IconBoxSeam size={16} />}
    type="number"
    suffix="cu ft"
  />
</FormSection>
    </MasterFormDialog>
  );
}
