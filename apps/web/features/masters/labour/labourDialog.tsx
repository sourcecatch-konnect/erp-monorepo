"use client";

import * as React from "react";

import type { LabourWithRelations } from "@skerp/types";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@skerp/ui/components/dialog";

import {
  SectionLabel,
  Field,
  formatDate,
  formatCurrencyFromPaise,
  SkeletonBody,
} from "../_shared/dialog-parts";

import {
  IconBuilding,
  IconCalendar,
  IconCash,
  IconCircleCheckFilled,
  IconClock,
  IconClockEdit,
  IconFileCertificate,
  IconHome,
  IconMapPin,
  IconPercentage,
  IconPhone,
  IconTool,
  IconUser,
} from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data?: LabourWithRelations;
  isLoading?: boolean;
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

function WorkerTypeBadge({ type }: { type?: string | null }) {
  const className =
    type === "Supervisor"
      ? "inline-flex items-center gap-1 rounded-md bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700"
      : type === "Mechanic"
        ? "inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
        : "inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700";

  return (
    <span className={className}>
      <IconTool size={12} />
      {formatLabel(type)}
    </span>
  );
}

export default function LabourDetailDialog({
  open,
  onOpenChange,
  data,
  isLoading,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] !max-w-[1000px] h-[90vh] !max-h-[90vh] gap-0 overflow-hidden rounded-2xl p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconUser size={20} />
            </span>

            <div>
              <DialogTitle>Labour Details</DialogTitle>

              {!isLoading && data ? (
                <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600">
                  <IconCircleCheckFilled size={10} />
                  Active Labour Profile
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {isLoading ? (
          <SkeletonBody />
        ) : (
          <div className="h-[calc(90vh-120px)] overflow-y-auto p-2">
            {/* Labour Overview */}
            <div className="px-5 py-5">
              <SectionLabel>Labour Overview</SectionLabel>

              <div className="flex items-center gap-4 rounded-xl border bg-muted/20 p-4">
                {/* No photo here, only icon block */}
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border bg-white text-primary">
                  <IconUser size={36} />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-lg font-semibold text-foreground">
                    {display(data?.name)}
                  </h3>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="flex items-center gap-1 font-semibold text-slate-900">
                      <IconPhone size={12} className="text-muted-foreground" />
                      {display(data?.mobileNo)}
                    </span>

                    <span className="text-muted-foreground">,</span>

                    <WorkerTypeBadge type={data?.type} />

                    <span className="text-muted-foreground">,</span>

                    <span className="flex items-center gap-1 font-semibold text-slate-900">
                      <IconBuilding size={12} className="text-muted-foreground" />
                      {display(data?.branch?.name)}
                    </span>

                    <span className="text-muted-foreground">,</span>

                    <span className="flex items-center gap-1 font-semibold text-slate-900">
                      <IconMapPin size={12} className="text-muted-foreground" />
                      {display(data?.city?.name)}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                    <div className="rounded-lg bg-white p-2">
                      <p className="text-muted-foreground">PAN</p>
                      <p className="font-medium">{display(data?.pan)}</p>
                    </div>

                    <div className="rounded-lg bg-white p-2">
                      <p className="text-muted-foreground">TDS Amount</p>
                      <p className="font-medium">
                        {formatCurrencyFromPaise(data?.tdsAmount)}
                      </p>
                    </div>

                    <div className="rounded-lg bg-white p-2">
                      <p className="text-muted-foreground">TDS Rate</p>
                      <p className="font-medium">
                        {data?.tdsRate != null ? `${data.tdsRate}%` : "-"}
                      </p>
                    </div>

                    <div className="rounded-lg bg-white p-2">
                      <p className="text-muted-foreground">Start Date</p>
                      <p className="font-medium">{formatDate(data?.startDate)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mx-5 border-t" />

            {/* Contact Information */}
          {/* Contact & Reference Details */}
<div className="px-5 py-5">
  <SectionLabel>Contact & Reference Details</SectionLabel>

  <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-3">
    <Field
      label="Contact Name"
      value={display(data?.contactName)}
      icon={<IconUser size={12} />}
    />

    <Field
      label="Contact Phone"
      value={display(data?.contactPhone)}
      icon={<IconPhone size={12} />}
    />

    <Field
      label="Referred By"
      value={display(data?.referredBy)}
      icon={<IconUser size={12} />}
    />

    <Field
      label="Reference Contact"
      value={display(data?.refContactNo)}
      icon={<IconPhone size={12} />}
    />
  </div>
</div>

<div className="mx-5 border-t" />

            {/* Finance Details */}
            <div className="px-5 py-5">
              <SectionLabel>Finance Details</SectionLabel>

              <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-3">
                <Field
                  label="PAN"
                  value={display(data?.pan)}
                  icon={<IconFileCertificate size={12} />}
                />

                <Field
                  label="TDS Amount"
                  value={formatCurrencyFromPaise(data?.tdsAmount)}
                  icon={<IconCash size={12} />}
                />

                <Field
                  label="TDS Rate"
                  value={data?.tdsRate != null ? `${data.tdsRate}%` : "-"}
                  icon={<IconPercentage size={12} />}
                />
              </div>
            </div>

            <div className="mx-5 border-t" />

            {/* Employment Details */}
            {/* Employment & Address Details */}
<div className="px-5 py-5">
  <SectionLabel>Employment & Address Details</SectionLabel>

  <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-3">
    <Field
      label="Start Date"
      value={formatDate(data?.startDate)}
      icon={<IconCalendar size={12} />}
    />

    <div className="md:col-span-2">
      <Field
        label="Address"
        value={display(data?.address)}
        icon={<IconHome size={12} />}
      />
    </div>
  </div>
</div>

<div className="mx-5 border-t" />

            <div className="mx-5 border-t" />

            {/* System Information */}
            <div className="px-5 py-5">
              <SectionLabel>System Information</SectionLabel>

              <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-3">
                <Field
                  label="Created At"
                  value={formatDate(data?.createdAt)}
                  icon={<IconCalendar size={12} />}
                />

                <Field
                  label="Updated At"
                  value={formatDate(data?.updatedAt)}
                  icon={<IconClockEdit size={12} />}
                />
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
