"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type {
  City,
  CreateDriverBody,
  CreateDriverFormInput,
  Driver,
  State,
} from "@skerp/types";
import {
  IconBan,
  IconBeach,
  IconCamera,
  IconCurrencyRupee,
  IconFileDescription,
  IconHome,
  IconId,
  IconLicense,
  IconMapPin,
  IconNotes,
  IconTrash,
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
import { toast } from "sonner";
import { Button } from "@skerp/ui/components/button";
import { driverApi } from "./driver.service";
import { createDriverSchema } from "@skerp/validators";
import { DatePicker } from "@skerp/ui/components/datepicker";
import { paiseToRupees } from "@/lib/money";
import { useQuery } from "@tanstack/react-query";
import { stateKeys } from "../state/state.keys";
import { stateApi } from "../state/state.service";
import { cityKeys } from "../city/city.keys";
import { cityApi } from "../city/city.service";
import { driverKeys } from "./driver.key";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";
import CitySelectField from "../_shared/fields/CitySelectField";
import { usePrefillDriver } from "@/features/dev-tools/usePrefillDriver";
type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: Driver | null;
  onSaved?: (driver: Driver) => void | Promise<void>;
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

const normalizeLicenseNo = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 15);

const normalizeAadharNo = (value: string) =>
  value.replace(/\D/g, "").slice(0, 12);
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
  licenseNo: "",
  licenseDate: "",
  licenseExpiryDate: "",
  licenseCity: "",
  address: "",
  country: "India",
  state: "",
  city: "",
  referencePerson: "",
  referenceContactNo: "",
  otherDetails: "",
  salary: "",
  panNo: "",
  aadharCardNo: "",
  onLeave: false,
  blackListed: false,
};

export default function DriverForm({
  open,
  onOpenChange,
  row,
  onSaved,
}: Props) {
  const { data: statesData } = useQuery({
    queryKey: stateKeys.list({ page: 0, size: 35 }),
    queryFn: () => stateApi.list({ page: 0, size: 35 }),
    enabled: open,
  });
  const { data: citiesData } = useQuery({
    queryKey: cityKeys.list({ page: 0, size: 1000 }),
    queryFn: () => cityApi.list({ page: 0, size: 1000 }),
    enabled: open,
  });
  const states = React.useMemo<State[]>(
    () => statesData?.data ?? [],
    [statesData],
  );
  const cities: City[] = citiesData?.data ?? [];

  const { create, update } = useMasterMutations({
    api: driverApi,
    queryKey: driverKeys.all,
    entityName: "Driver",
  });
  const prefillDriver = usePrefillDriver({
    states,
    cities,
  });

  const handleSubmit = async (data: CreateDriverBody) => {
    const saved = row
      ? await update.mutateAsync({ id: row.id, data })
      : await create.mutateAsync(data);

    await onSaved?.(saved);
    onOpenChange(false);
  };
  const form = useForm<CreateDriverFormInput, unknown, CreateDriverBody>({
    resolver: zodResolver(createDriverSchema),
    defaultValues,
    mode: "onChange",
    reValidateMode: "onChange",
  });
  const addressState = form.watch("state");

  const addressStateId = React.useMemo(() => {
    return states.find((state) => state.name === addressState)?.id ?? "";
  }, [states, addressState]);

  const previousAddressState = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    if (!open) return;

    if (
      previousAddressState.current &&
      previousAddressState.current !== addressState
    ) {
      form.setValue("city", "");
    }

    previousAddressState.current = addressState;
  }, [open, addressState, form]);

  const [hasReference, setHasReference] = React.useState(false);
  const [photoPreviewUrl, setPhotoPreviewUrl] = React.useState("");
  const [isPhotoUploading, setIsPhotoUploading] = React.useState(false);
  const localPhotoPreviewRef = React.useRef<string | null>(null);
  const handlePrefill = () => {
    if (!prefillDriver) return;

    const next = prefillDriver();

    form.reset(next);
    setHasReference(true);
    setPhotoPreviewUrl("");

    if (localPhotoPreviewRef.current) {
      URL.revokeObjectURL(localPhotoPreviewRef.current);
      localPhotoPreviewRef.current = null;
    }

    previousAddressState.current = next.state;
  };
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
      licenseNo: row?.licenseNo ?? "",
      licenseDate: toDateInput(row?.licenseDate),
      licenseExpiryDate: toDateInput(row?.licenseExpiryDate),
      licenseCity: row?.licenseCity ?? "",
      address: row?.address ?? "",
      country: row?.country ?? "India",
      state: row?.state ?? "",
      city: row?.city ?? "",
      referencePerson: row?.referencePerson ?? "",
      referenceContactNo: row?.referenceContactNo ?? "",
      otherDetails: row?.otherDetails ?? "",
      salary: row?.salary != null ? String(paiseToRupees(row.salary)) : "",
      panNo: row?.panNo ?? "",
      aadharCardNo: row?.aadharCardNo ?? "",
      onLeave: row?.onLeave ?? false,
      blackListed: row?.blackListed ?? false,
    });

    setHasReference(Boolean(row?.referencePerson || row?.referenceContactNo));
  }, [form, open, row]);
  React.useEffect(() => {
    if (!open) return;

    let active = true;

    async function loadPhotoPreview() {
      setPhotoPreviewUrl("");

      if (!row?.photoPath) return;

      try {
        const { viewUrl } = await driverApi.getPhotoViewUrl(row.photoPath);

        if (active) {
          setPhotoPreviewUrl(viewUrl);
        }
      } catch {
        if (active) {
          setPhotoPreviewUrl("");
        }
      }
    }

    loadPhotoPreview();

    return () => {
      active = false;
    };
  }, [open, row?.photoPath]);

  const handleHasReferenceToggle = (checked: boolean) => {
    setHasReference(checked);

    if (!checked) {
      form.setValue("referencePerson", "");
      form.setValue("referenceContactNo", "");
    }
  };
  const handlePhotoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      toast.error("Only JPG, PNG, and WebP driver photos are allowed.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Driver photo must be less than 2 MB.");
      return;
    }

    try {
      setIsPhotoUploading(true);

      const localPreview = URL.createObjectURL(file);

      if (localPhotoPreviewRef.current) {
        URL.revokeObjectURL(localPhotoPreviewRef.current);
      }

      localPhotoPreviewRef.current = localPreview;
      setPhotoPreviewUrl(localPreview);

      const { key, uploadUrl } = await driverApi.getPhotoUploadUrl({
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
      });

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload driver photo.");
      }

      form.setValue("photoPath", key, {
        shouldDirty: true,
        shouldValidate: true,
      });

      toast.success("Driver photo uploaded.");
    } catch (error) {
      setPhotoPreviewUrl("");
      form.setValue("photoPath", "", {
        shouldDirty: true,
        shouldValidate: true,
      });

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to upload driver photo.",
      );
    } finally {
      setIsPhotoUploading(false);
      event.target.value = "";
    }
  };
  const handleRemovePhoto = () => {
    if (localPhotoPreviewRef.current) {
      URL.revokeObjectURL(localPhotoPreviewRef.current);
      localPhotoPreviewRef.current = null;
    }

    setPhotoPreviewUrl("");

    form.setValue("photoPath", null, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };
  React.useEffect(() => {
    return () => {
      if (localPhotoPreviewRef.current) {
        URL.revokeObjectURL(localPhotoPreviewRef.current);
      }
    };
  }, []);

  return (
    <MasterFormDialog<CreateDriverFormInput, CreateDriverBody>
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Driver" : "Add Driver"}
      form={form}
      onSubmit={handleSubmit}
      isSubmitting={create.isPending || update.isPending}
      columns={3}
      footerLeft={
        prefillDriver ? (
          <button
            type="button"
            onClick={handlePrefill}
            className="flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 4-1 1" />
              <path d="m4 15 1-1" />
              <path d="m10.5 6.5-5 5" />
              <path d="M6 6l12 12" />
              <path d="m18 6-1.5 1.5" />
              <path d="m8.5 18-1 1" />
            </svg>
            Fill Test Data
          </button>
        ) : undefined
      }
    >
      <FormSection
        icon={<IconUser size={18} />}
        title="Personal Information"
        description="Basic identity and contact details"
      >
        <input type="hidden" {...form.register("photoPath")} />

        <div className="col-span-full flex flex-col gap-4 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-white">
            {photoPreviewUrl ? (
              <img
                src={photoPreviewUrl}
                alt="Driver photo"
                className="h-full w-full object-cover"
              />
            ) : (
              <IconCamera size={34} className="text-muted-foreground" />
            )}
          </div>

          <div className="grid flex-1 gap-2">
            <div>
              <p className="text-sm font-medium">Driver Photo</p>
              <p className="text-xs text-muted-foreground">
                Upload JPG, PNG or WebP image. Maximum size 500 KB.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center rounded-md border bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-muted">
                {isPhotoUploading ? "Uploading..." : "Upload Photo"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={isPhotoUploading}
                  onChange={handlePhotoUpload}
                />
              </label>

              {photoPreviewUrl ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPhotoUploading}
                  onClick={handleRemovePhoto}
                >
                  <IconTrash size={15} className="mr-1" />
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
        </div>
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

        <IconTextField<CreateDriverFormInput>
          name="mobile"
          label="Mobile Number"
          placeholder="10-digit mobile"
          prefix="+91"
          maxLength={10}
          hint="Used for trip & emergency contact"
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
          maxLength={15}
          transformValue={normalizeLicenseNo}
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
        title="Address"
        description="Where the driver is based"
      >
        <div className="md:col-span-2 xl:col-span-3">
          <TextAreaField<CreateDriverFormInput>
            name="address"
            label="Address Line"
            placeholder="House / Street / Locality"
            maxLength={250}
            rows={2}
          />
        </div>

        <IconTextField<CreateDriverFormInput>
          name="country"
          label="Country"
          icon={<IconMapPin size={16} />}
        />

        <SelectField<CreateDriverFormInput>
          name="state"
          label="State"
          placeholder="Select state"
          options={states.map((state) => ({
            label: state.name,
            value: state.name,
          }))}
        />

        <CitySelectField<CreateDriverFormInput>
          name="city"
          label="City"
          placeholder={addressState ? "Select city" : "Select state first"}
          disabled={!addressStateId}
          stateId={addressStateId}
          valueMode="name"
          initialCity={
            row?.city
              ? {
                  id: row.city,
                  name: row.city,
                }
              : null
          }
        />
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
        description="PAN, Aadhar and salary details"
      >
        <IconTextField<CreateDriverFormInput>
          name="panNo"
          label="PAN Number"
          placeholder="ABCDE1234F"
          icon={<IconFileDescription size={16} />}
          maxLength={10}
          onChangeTransform={(value) => value.toUpperCase()}
          hint="10-character PAN"
        />
        <IconTextField<CreateDriverFormInput>
          name="aadharCardNo"
          label="Aadhar Number"
          placeholder="12-digit Aadhar"
          icon={<IconId size={16} />}
          maxLength={12}
          transformValue={normalizeAadharNo}
          inputMode="numeric"
        />

        <IconTextField<CreateDriverFormInput>
          name="salary"
          label="Monthly Salary"
          placeholder="0.00"
          icon={<IconCurrencyRupee size={16} />}
          type="number"
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
