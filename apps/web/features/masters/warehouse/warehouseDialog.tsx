"use client";

import * as React from "react";
import type { WarehouseWithRelations } from "@skerp/types";

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
  IconBuildingWarehouse,
  IconMapPin,
  IconPhone,
  IconUser,
  IconCalendar,
  IconCash,
  IconCircleCheckFilled,
  IconClockEdit,
  IconCalendarCheck,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { warehouseApi } from "./warehouse.service";
import { warehouseKeys } from "./warehouse.key";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data?: WarehouseWithRelations;
   id?: string | null;
};

const display = (value?: string | number | null) => {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
};

const formatUnit = (value?: number | null, unit?: string) => {
  if (value === null || value === undefined) return "-";
  return `${value.toLocaleString("en-IN")} ${unit}`;
};
const formatLabel = (value?: string | null) => {
  if (!value) return "-";

  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};
export default function WarehouseDetailDialog({
  open,
  onOpenChange,
  id,
}: Props) {
  const warehouseDetail = useQuery({
  queryKey: id ? warehouseKeys.detail(id) : ["warehouse-detail-empty"],
  queryFn: () => warehouseApi.detail(id!),
  enabled: Boolean(open && id),
});

const data = warehouseDetail.data as WarehouseWithRelations | undefined;
const isLoading = warehouseDetail.isLoading;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] !max-w-[1000px] h-[90vh] !max-h-[90vh] gap-0 overflow-hidden rounded-2xl p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconBuildingWarehouse size={20} />
            </span>

            <div>
              <DialogTitle>Warehouse Details</DialogTitle>

              {!isLoading && data ? (
                <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600">
                  <IconCircleCheckFilled size={10} />
                  Active Warehouse
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {isLoading ? (
          <SkeletonBody />
        ) : (
          <div className="h-[calc(90vh-120px)] overflow-y-auto p-2">
            {/* Overview */}
         {/* Warehouse Overview */}
<div className="px-5 py-5">
  <SectionLabel>Warehouse Overview</SectionLabel>

  <div className="flex items-center gap-4 rounded-xl border bg-muted/20 p-4">
    {/* No picture for warehouse, only icon block */}
    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border bg-white text-orange-700">
      <IconBuildingWarehouse size={36} />
    </div>

    <div className="min-w-0 flex-1">
      <h3 className="truncate text-lg font-semibold text-foreground">
        {display(data?.name)}
      </h3>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="flex items-center gap-1 font-semibold text-slate-900">
          <IconBuildingWarehouse size={12} className="text-muted-foreground" />
          {display(data?.branch?.name)}
        </span>

      

       
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
        <div className="rounded-lg bg-white p-2">
          <p className="text-muted-foreground">Warehouse Type</p>
          <p className="font-medium">{formatLabel(data?.type)}</p>
        </div>

        <div className="rounded-lg bg-white p-2">
          <p className="text-muted-foreground">Gate / Dock</p>
          <p className="font-medium">{display(data?.gateNo)}</p>
        </div>

        <div className="rounded-lg bg-white p-2">
          <p className="text-muted-foreground">Storage Capacity</p>
          <p className="font-medium">
            {formatUnit(data?.storageCapacity, "cu ft")}
          </p>
        </div>

       <div className="rounded-lg bg-white p-2">
  <p className="text-muted-foreground">Dimensions</p>
  <p className="font-medium">
    {data?.length || data?.width || data?.breadth
      ? `L: ${display(data?.length)} ft × W: ${display(data?.width)} ft × H: ${display(data?.breadth)} ft`
      : "-"}
  </p>
</div>
      </div>
    </div>
  </div>
</div>

            <div className="mx-5 border-t" />

            {/* Basic Information */}
           

            <div className="mx-5 border-t" />

            {/* Location Details */}
            <div className="px-5 py-5">
              <SectionLabel>Location Details</SectionLabel>

              <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-3">
                <Field
                  label="Country"
                  value={display(data?.country)}
                  icon={<IconMapPin size={12} />}
                />

                <Field
                  label="State"
                  value={display(data?.state?.name)}
                  icon={<IconMapPin size={12} />}
                />

                <Field
                  label="City"
                  value={display(data?.city?.name)}
                  icon={<IconMapPin size={12} />}
                />

                <Field
                  label="Address"
                  value={display(data?.address)}
                  icon={<IconMapPin size={12} />}
                />
              </div>
            </div>

            <div className="mx-5 border-t" />

            {/* Contact Details */}
            <div className="px-5 py-5">
              <SectionLabel>Contact Details</SectionLabel>

              <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-3">
                <Field
                  label="Contact Person"
                  value={display(data?.contactName)}
                  icon={<IconUser size={12} />}
                />

                <Field
                  label="Contact Phone"
                  value={display(data?.contactPhone)}
                  icon={<IconPhone size={12} />}
                />
              </div>
            </div>

            <div className="mx-5 border-t" />

           {/* Rent & Agreement Details */}
<div className="px-5 py-5">
  <SectionLabel>Rent & Agreement Details</SectionLabel>

  <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-3">
    <Field
      label="Monthly Rent"
      value={formatCurrencyFromPaise(data?.monthlyRent)}
      icon={<IconCash size={12} />}
    />

    <Field
      label="Security Deposit"
      value={formatCurrencyFromPaise(data?.securityDeposit)}
      icon={<IconCash size={12} />}
    />

    <Field
      label="Rent Start Date"
      value={formatDate(data?.agreementDate)}
      icon={<IconCalendar size={12} />}
    />

    <Field
      label="Rent Expiry Date"
      value={formatDate(data?.expiryDate)}
      icon={<IconCalendarCheck size={12} />}
    />
  </div>
</div>

<div className="mx-5 border-t" />
            <div className="mx-5 border-t" />

            {/* Dimensions & Capacity */}
         

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
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <IconCalendarCheck size={12} />
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
