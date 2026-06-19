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

import {
  IconBuilding,
  IconFileCertificate,
  IconImageInPicture,
  IconMapPin,
  IconPhone,
} from "@tabler/icons-react";

import { createCompanySchema } from "@skerp/validators";
// import { DatePicker } from "../_shared/fields/DateField";
import { DatePicker } from "@skerp/ui/components/datepicker";
import MasterFormDialog from "../_shared/MasterFormDialog";
import SelectField from "../_shared/fields/SelectField";
import FormSection from "../_shared/fields/FormSection";
import IconTextField from "../_shared/fields/IconTextField";
import TextAreaField from "../_shared/fields/TextAreaField";
import { useQuery } from "@tanstack/react-query";
import { stateKeys } from "../state/state.keys";
import { stateApi } from "../state/state.service";

import { useMasterMutations } from "../_shared/hooks/useMasterMutation";
import { companyApi } from "./company.service";
import { companyKeys } from "./company.key";
import CitySelectField from "../_shared/fields/CitySelectField";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: Company | null;
};

const defaultValues: CreateCompanyFormInput = {
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
};

export default function CompanyForm({
  open,
  onOpenChange,
  row,

}: Props) {
  const form = useForm<CreateCompanyFormInput, unknown, CreateCompanyBody>({
    resolver: zodResolver(createCompanySchema),
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
  api: companyApi,
  queryKey: companyKeys.all,
  entityName: "Company",
});

const handleSubmit = async (data: CreateCompanyBody) => {
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
  const stateOptions = (states.data?.data ?? []).map((state) => ({
  label: state.name,
  value: state.id,
}));


  return (
    <MasterFormDialog<CreateCompanyFormInput, CreateCompanyBody>
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Company" : "Add Company"}
      form={form}
      onSubmit={handleSubmit
        
      }
      isSubmitting={isSubmitting}
      columns={3}
    >
      <FormSection
        icon={<IconBuilding size={18} />}
        title="Company Information"
        description="Basic company identity and registration details"
      >
        <IconTextField<CreateCompanyFormInput>
          name="name"
          label="Company Name"
          placeholder="Enter company name"
          icon={<IconBuilding size={16} />}
          required
        />

        <IconTextField<CreateCompanyFormInput>
  name="companyPAN"
  label="Company PAN"
  placeholder="ABCDE1234F"
  icon={<IconFileCertificate size={16} />}
  onChangeTransform={(value) => value.toUpperCase()}
/>

        <IconTextField<CreateCompanyFormInput>
          name="companyTAN"
          label="Company TAN"
          placeholder="ABCD12345E"
          icon={<IconFileCertificate size={16} />}
          onChangeTransform={(value) => value.toUpperCase()}
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

        <IconTextField<CreateCompanyFormInput>
          name="mainLogoPath"
          label="Main Logo Path"
          placeholder="Enter logo path"
          icon={<IconImageInPicture size={16} />}
        />
      </FormSection>

      <FormSection
        icon={<IconMapPin size={18} />}
        title="Address Details"
        description="Company location and registered address"
      >
        <IconTextField<CreateCompanyFormInput>
          name="country"
          label="Country"
          placeholder="Enter country"
          icon={<IconMapPin size={16} />}
          required
        />

        <SelectField<CreateCompanyFormInput>
          name="stateId"
          label="State"
          options={stateOptions}
        />

       <CitySelectField<CreateCompanyFormInput>
  name="cityId"
  label="City"
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
          <TextAreaField<CreateCompanyFormInput>
            name="address"
            label="Address"
            placeholder="Enter address"
            rows={2}
            maxLength={250}
          />
        </div>
      </FormSection>

      <FormSection
        icon={<IconPhone size={18} />}
        title="Contact Details"
        description="Primary communication information"
      >
        <IconTextField<CreateCompanyFormInput>
          name="contactPhone"
          label="Contact Phone"
          placeholder="10-digit phone number"
          icon={<IconPhone size={16} />}
          maxLength={10}
        />
      </FormSection>
    </MasterFormDialog>
  );
}