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
import SelectField from "../_shared/fields/SelectField";

import {
  IconBuilding,
  IconMapPin,
  IconCalendar,
  IconTruck,
  IconX,
  IconFileUpload,
} from "@tabler/icons-react";
import { DatePicker } from "@skerp/ui/components/datepicker";
import { Button } from "@skerp/ui/components/button";
import { attachmentApi } from "@/features/attachments/attachment.client";
import { AttachmentPanel } from "@skerp/attachments-web";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  row?: Agreement | null;
  onSubmit: (
  data: CreateAgreementBody,
  agreementFile?: File | null,
) => Promise<void>;
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
const [agreementFile, setAgreementFile] = React.useState<File | null>(null);
  React.useEffect(() => {
    if (!open) return;
      setAgreementFile(null);
    form.reset({
      companyId: row?.companyId ?? "",
      clientId: row?.clientId ?? "",
      cityId: row?.cityId ?? "",
      leadGeneratedByBranchId: row?.leadGeneratedByBranchId ?? "",
      startDate: row?.startDate ? String(row.startDate) : "",
      agreementDate: row?.agreementDate ? String(row.agreementDate) : "",
      expiryDate: row?.expiryDate ? String(row.expiryDate) : "",

    });
  }, [open, row, form]);

const agreementFileInputRef = React.useRef<HTMLInputElement | null>(null);
  return (
    <MasterFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Agreement" : "Add Agreement"}
      form={form}
      onSubmit={async (data) => {
  await onSubmit(data, agreementFile);
  setAgreementFile(null);
}}
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
          label="Consigner"
          options={customers.map((c) => ({
            label: c.name,
            value: c.id,
          }))}
        />
      </FormSection>

      {/* ================= LOCATION ================= */}
      <FormSection
        icon={<IconMapPin size={18} />}
        title="City and branch responsible for agreement"
        description="Location Details"
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
  icon={<IconFileUpload size={18} />}
  title="Agreement Upload"
  description="Upload signed agreement PDF or scanned agreement copy"
>
  {row?.id ? (
    <div className="col-span-full">
      <AttachmentPanel
        api={attachmentApi}
        entityType="agreement"
        entityId={row.id}
      />
    </div>
  ) : (
  <div className="col-span-full rounded-xl border border-dashed border-border bg-muted/20 p-4">
  <div className="flex flex-col items-center justify-center gap-3 text-center">
    <div className="rounded-full bg-background p-3">
      <IconFileUpload className="size-7 text-muted-foreground" />
    </div>

    <div>
      <p className="text-sm font-medium text-foreground">
        Upload Agreement File
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        PDF file only
      </p>
    </div>

    <input
      ref={agreementFileInputRef}
      type="file"
      accept="application/pdf,.pdf"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0] ?? null;

        if (!file) return;

        if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
          setAgreementFile(null);
          e.target.value = "";
          return;
        }

        setAgreementFile(file);
        e.target.value = "";
      }}
    />

    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => agreementFileInputRef.current?.click()}
    >
      <IconFileUpload className="mr-2 size-4" />
      Choose PDF File
    </Button>
  </div>

  {agreementFile ? (
    <div className="mt-4 flex items-center justify-between rounded-lg border bg-background px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {agreementFile.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {(agreementFile.size / (1024 * 1024)).toFixed(2)} MB
        </p>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setAgreementFile(null)}
      >
        <IconX className="size-4" />
      </Button>
    </div>
  ) : null}

  <p className="mt-3 text-xs text-muted-foreground">
    File will be uploaded after the agreement is created.
  </p>
</div>
  )}
</FormSection>
    </MasterFormDialog>
  );
}