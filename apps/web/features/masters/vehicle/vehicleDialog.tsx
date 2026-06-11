"use client";

import * as React from "react";
import type { Vehicle } from "@skerp/types";

import {
  Dialog,
  DialogContent,
} from "@skerp/ui/components/dialog";

import { Skeleton } from "@skerp/ui/components/skeleton";

import {
  SectionLabel,
  Field,
  formatDate,
} from "../_shared/dialog-parts";

import {
  IconTruck,
  IconId,
  IconCalendar,
  IconGauge,
  IconShieldCheck,
  IconRuler,
  IconCircleDot,
  IconCircleCheckFilled,
  IconClockEdit,
  IconCalendarCheck,
} from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data?: Vehicle;
  isLoading?: boolean;
};

function SkeletonBody() {
  return (
    <div className="space-y-6 p-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i}>
          <Skeleton className="mb-3 h-4 w-28" />

          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, x) => (
              <Skeleton
                key={x}
                className="h-14 rounded-xl"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function VehicleDetailDialog({
  open,
  onOpenChange,
  data,
  isLoading,
}: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent
        className="w-[92vw] !max-w-[1000px] h-[90vh] !max-h-[90vh] gap-0 overflow-hidden rounded-2xl p-0"
      >
        {/* Header */}

        <div className="flex items-center justify-between border-b px-5 py-4">

          <div className="flex items-center gap-3">

            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconTruck size={20}/>
            </span>

            <div>
              <p className="text-sm font-semibold">
                Vehicle Details
              </p>

              {!isLoading && data && (
                <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600">
                  <IconCircleCheckFilled size={10}/>
                  Active Vehicle
                </div>
              )}
            </div>

          </div>

        </div>

        {isLoading ? (
          <SkeletonBody/>
        ) : (
          <div className="h-[calc(90vh-120px)] overflow-y-auto">

            {/* Vehicle Information */}

            <div className="px-5 py-5">

              <SectionLabel>
                Vehicle Information
              </SectionLabel>

              <div className="grid grid-cols-3 gap-x-6 gap-y-4">

                <Field
                  label="Vehicle Number"
                  value={data?.vehicleNumber}
                  icon={<IconTruck size={12}/>}
                />

                <Field
                  label="Chasis Number"
                  value={data?.chasisNumber}
                  icon={<IconId size={12}/>}
                />

                <Field
                  label="Engine Number"
                  value={data?.engineNumber}
                  icon={<IconId size={12}/>}
                />

                <Field
                  label="Ownership Type"
                  value={data?.ownershipType}
                  icon={<IconTruck size={12}/>}
                />

                <Field
                  label="Vehicle Type"
                  value={
                    (data as { vehicleTypeRef?: { name?: string } } | undefined)
                      ?.vehicleTypeRef?.name
                  }
                  icon={<IconTruck size={12}/>}
                />

                <Field
                  label="Capacity"
                  value={
                    data?.capacityMT != null
                      ? `${data.capacityMT} MT`
                      : "-"
                  }
                  icon={<IconGauge size={12}/>}
                />

                <Field
                  label="Wheels"
                  value={data?.wheels}
                  icon={<IconCircleDot size={12}/>}
                />

                <Field
                  label="Body Type"
                  value={data?.bodyType}
                  icon={<IconTruck size={12}/>}
                />

                <Field
                  label="Length"
                  value={
                    data?.lengthFeet != null
                      ? `${data.lengthFeet} ft`
                      : "-"
                  }
                  icon={<IconRuler size={12}/>}
                />

                <Field
                  label="Opening KM"
                  value={data?.openingKM}
                  icon={<IconGauge size={12}/>}
                />

                <Field
                  label="Current KM"
                  value={data?.currentKM}
                  icon={<IconGauge size={12}/>}
                />

                <Field
                  label="Purchase Date"
                  value={formatDate(data?.purchaseDate)}
                  icon={<IconCalendar size={12}/>}
                />

                <Field
                  label="Status"
                  value={data?.status}
                  icon={<IconCircleCheckFilled size={12}/>}
                />

              </div>

            </div>

            <div className="mx-5 border-t"/>

            {/* Insurance */}

            <div className="px-5 py-5">

              <SectionLabel>
                Insurance Information
              </SectionLabel>

              <div className="grid grid-cols-3 gap-x-6 gap-y-4">

                <Field
                  label="Insurance Number"
                  value={data?.insuranceNumber}
                  icon={<IconShieldCheck size={12}/>}
                />

                <Field
                  label="Insurance Company"
                  value={data?.insuranceCompany}
                  icon={<IconShieldCheck size={12}/>}
                />

                <Field
                  label="Issue Date"
                  value={formatDate(data?.insuranceIssueDate)}
                  icon={<IconCalendar size={12}/>}
                />

                <Field
                  label="Due Date"
                  value={formatDate(data?.insuranceDueDate)}
                  icon={<IconCalendar size={12}/>}
                />

              </div>

            </div>

            <div className="mx-5 border-t"/>

            {/* System */}

            <div className="px-5 py-5">

              <SectionLabel>
                System Information
              </SectionLabel>

              <div className="grid grid-cols-3 gap-x-6 gap-y-4">

           

                <Field
                  label="Created At"
                  value={formatDate(data?.createdAt)}
                  icon={<IconCalendar size={12}/>}
                />

                <Field
                  label="Updated At"
                  value={formatDate(data?.updatedAt)}
                  icon={<IconClockEdit size={12}/>}
                />

              </div>

            </div>

          </div>
        )}

        {/* Footer */}

        <div className="flex items-center justify-between border-t bg-muted/30 px-5 py-3">

          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <IconCalendarCheck size={12}/>
            Updated {formatDate(data?.updatedAt)}
          </span>

          <button
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