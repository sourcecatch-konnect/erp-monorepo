"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@skerp/ui/components/dialog";

import {
  SectionLabel,
  Field,
  formatDate,
  SkeletonBody,
} from "../_shared/dialog-parts";

import {
  IconTruck,
  IconUser,
  IconPhone,
  IconId,
  IconCalendar,
  IconBan,
  IconClock,
  IconMapPin,
  IconCircleCheckFilled,
  IconClockEdit,
  IconCamera,
  IconCurrencyRupee,
  IconIdBadge2,
  IconNotes,
  IconHome,
  IconBeach,
  IconCircleCheck,
} from "@tabler/icons-react";

import { driverApi } from "./driver.service";
import { formatPaise } from "@/lib/money";
import { useQuery } from "@tanstack/react-query";
import { driverKeys } from "./driver.key";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  id?: string | null;
};

const display = (value?: string | number | null) => {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
};
const formatLabel = (value?: string | null) => {
  if (!value) return "-";

  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

function DriverStatusBadge({
  status,
  onLeave,
  blackListed,
}: {
  status?: string | null;
  onLeave?: boolean | null;
  blackListed?: boolean | null;
}) {
  if (blackListed) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        <IconBan size={12} /> Blacklisted
      </span>
    );
  }

  if (onLeave) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
        <IconBeach size={12} /> On Leave
      </span>
    );
  }

  return (
    <span
      className={
        status === "AVAILABLE"
          ? "inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
          : "inline-flex items-center gap-1 rounded-md bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700"
      }
    >
      <IconCircleCheck size={12} /> {formatLabel(status)}
    </span>
  );
}


const formatBoolean = (value?: boolean | null) => {
  if (value === null || value === undefined) return "-";
  return value ? "Yes" : "No";
};

// Values are paise; delegate to the shared formatter.
const formatCurrency = (value?: number | null) => formatPaise(value);

export default function DriverDetailDialog({
  open,
  onOpenChange,
  id,
}: Props) {
  const driverDetail = useQuery({
    queryKey: id ? driverKeys.detail(id) : ["driver-detail-empty"],
    queryFn: () => driverApi.detail(id!),
    enabled: Boolean(open && id),
  });

  const data = driverDetail.data;
  const isLoading = driverDetail.isLoading;
  const [photoPreviewUrl, setPhotoPreviewUrl] = React.useState("");

  React.useEffect(() => {
    if (!open) return;

    let active = true;

    async function loadPhotoPreview() {
      setPhotoPreviewUrl("");

      if (!data?.photoPath) return;

      try {
        const { viewUrl } = await driverApi.getPhotoViewUrl(data.photoPath);

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
  }, [open, data?.photoPath]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] !max-w-[1000px] h-[90vh] !max-h-[90vh] gap-0 overflow-hidden rounded-2xl p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconTruck size={20} />
            </span>

            <div>
              <DialogTitle>Driver Details</DialogTitle>

             {!isLoading && data ? (
  <div className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
    <IconCircleCheckFilled size={10} />
    Active Profile
  </div>
) : null}
            </div>
          </div>
        </div>

        {isLoading ? (
          <SkeletonBody />
        ) : (
          <div className="h-[calc(90vh-120px)] overflow-y-auto p-2">
            {/* Driver Overview */}
            <div className="px-5 py-5">
              <SectionLabel>Driver Overview</SectionLabel>

              <div className="flex items-center gap-4 rounded-xl border bg-muted/20 p-4">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-white">
                  {photoPreviewUrl ? (
                    <img
                      src={photoPreviewUrl}
                      alt={data?.name ?? "Driver photo"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <IconCamera size={34} className="text-muted-foreground" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-lg font-semibold">
                    {display(data?.name)}
                  </h3>

<div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
  <span className="flex items-center gap-1 font-semibold text-slate-900">
    <IconPhone size={12} className="text-muted-foreground" />
    {display(data?.mobile)}
  </span>

  <span className="text-muted-foreground">,</span>

  <DriverStatusBadge
    status={data?.status}
    onLeave={data?.onLeave}
    blackListed={data?.blackListed}
  />
</div>

             <div className="mt-3 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
  <div className="rounded-lg bg-white p-2">
    <p className="text-muted-foreground">License No</p>
    <p className="font-medium">{display(data?.licenseNo)}</p>
  </div>

  <div className="rounded-lg bg-white p-2">
    <p className="text-muted-foreground">Driver Type</p>
    <p className="font-medium">{display(data?.type)}</p>
  </div>
</div>
                </div>
              </div>
            </div>

            <div className="mx-5 border-t" />

            {/* Personal Information */}
            {/* Personal Information */}
<div className="px-5 py-5">
  <SectionLabel>Personal Information</SectionLabel>

  <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-3">
    <Field
      label="Full Name"
      value={display(data?.name)}
      icon={<IconUser size={12} />}
    />

  </div>
</div>

            <div className="mx-5 border-t" />


            {/* License Information */}
            <div className="px-5 py-5">
              <SectionLabel>Driving License</SectionLabel>

              <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-3">
                <Field label="License No" value={display(data?.licenseNo)} icon={<IconId size={12} />} />
                <Field label="Issuing City / RTO" value={display(data?.licenseCity)} icon={<IconMapPin size={12} />} />
                <Field label="License Issue Date" value={formatDate(data?.licenseDate)} icon={<IconCalendar size={12} />} />
                <Field label="License Expiry Date" value={formatDate(data?.licenseExpiryDate)} icon={<IconCalendar size={12} />} />
              </div>
            </div>

            <div className="mx-5 border-t" />

            {/* Address */}
            <div className="px-5 py-5">
              <SectionLabel>Address</SectionLabel>

              <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-3">
                <Field label="Address" value={display(data?.address)} icon={<IconHome size={12} />} />
                <Field label="Country" value={display(data?.country)} icon={<IconMapPin size={12} />} />
                <Field label="State" value={display(data?.state)} icon={<IconMapPin size={12} />} />
                <Field label="City" value={display(data?.city)} icon={<IconMapPin size={12} />} />
              </div>
            </div>

            <div className="mx-5 border-t" />

            {/* Identification & Payroll */}
            <div className="px-5 py-5">
              <SectionLabel>Identification & Payroll</SectionLabel>

              <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-3">
                <Field label="PAN Number" value={display(data?.panNo)} icon={<IconIdBadge2 size={12} />} />
                <Field label="Monthly Salary" value={formatCurrency(data?.salary)} icon={<IconCurrencyRupee size={12} />} />
                <Field label="Joining Date" value={formatDate(data?.joiningDate)} icon={<IconCalendar size={12} />} />
                <Field label="Leaving Date" value={formatDate(data?.leavingDate)} icon={<IconCalendar size={12} />} />
              </div>
            </div>

            <div className="mx-5 border-t" />

            {/* Status & Flags */}
            <div className="px-5 py-5">
              <SectionLabel>Status & Flags</SectionLabel>

              <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-3">
                <Field label="On Leave" value={formatBoolean(data?.onLeave)} icon={<IconBeach size={12} />} />
                <Field label="Black Listed" value={formatBoolean(data?.blackListed)} icon={<IconBan size={12} />} />
              </div>
            </div>

            <div className="mx-5 border-t" />

            {/* Other Details */}
            <div className="px-5 py-5">
              <SectionLabel>Other Details</SectionLabel>

              <div className="grid grid-cols-1 gap-x-6 gap-y-4">
                <Field label="Notes" value={display(data?.otherDetails)} icon={<IconNotes size={12} />} />
              </div>
            </div>

            <div className="mx-5 border-t" />

            {/* System Info */}
            <div className="px-5 py-5">
              <SectionLabel>System Information</SectionLabel>

              <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-3">
                <Field label="Created At" value={formatDate(data?.createdAt)} icon={<IconCalendar size={12} />} />
                <Field label="Updated At" value={formatDate(data?.updatedAt)} icon={<IconClockEdit size={12} />} />
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t bg-muted/30 px-5 py-3">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <IconClock size={12} />
            Updated {formatDate(data?.updatedAt)}
          </span>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg border px-4 py-1.5 text-xs"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
