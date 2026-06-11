"use client";

import * as React from "react";
import type { Driver } from "@skerp/types";

import {
  Dialog,
  DialogContent,
} from "@skerp/ui/components/dialog";

import { Skeleton } from "@skerp/ui/components/skeleton";

import {
  SectionLabel,
  Field,
  PartyCard,
  formatDate,
} from "../_shared/dialog-parts";

import {
  IconTruck,
  IconUser,
  IconPhone,
  IconId,
  IconCalendar,
  IconShield,
  IconBan,
  IconClock,
  IconMapPin,
  IconCircleCheckFilled,
  IconClockEdit,
} from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data?: Driver;
  isLoading?: boolean;
};

function SkeletonBody() {
  return (
    <div className="space-y-6 p-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i}>
          <Skeleton className="mb-3 h-4 w-28" />

          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, x) => (
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

export default function DriverDetailDialog({
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
                Driver Details
              </p>

              {!isLoading && data && (
                <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600">
                  <IconCircleCheckFilled size={10}/>
                  Active Profile
                </div>
              )}
            </div>

          </div>

        </div>

        {isLoading ? (
          <SkeletonBody />
        ) : (
          <div className="h-[calc(90vh-120px)] overflow-y-auto">

            {/* Driver Summary */}

            <div className="px-5 py-5">

              <SectionLabel>
                Driver Overview
              </SectionLabel>

              <PartyCard
                label="Driver"
                name={data?.name}
                subtitle={data?.mobile ?? "-"}
                colorClass="bg-blue-100 text-blue-700"
                icon={<IconUser size={15}/>}
              />

            </div>

            <div className="mx-5 border-t" />

            {/* Driver Information */}

            <div className="px-5 py-5">

              <SectionLabel>
                Driver Information
              </SectionLabel>

              <div className="grid grid-cols-3 gap-x-6 gap-y-4">

                <Field
                  label="Mobile No"
                  value={data?.mobile}
                  icon={<IconPhone size={12}/>}
                />

                <Field
                  label="Alternate Phone"
                  value={data?.alternateMobile}
                  icon={<IconPhone size={12}/>}
                />

                <Field
                  label="License No"
                  value={data?.licenseNo}
                  icon={<IconId size={12}/>}
                />

                <Field
                  label="License Expiry"
                  value={formatDate(data?.licenseExpiryDate)}
                  icon={<IconCalendar size={12}/>}
                />

                <Field
                  label="Driver Type"
                  value={data?.type}
                  icon={<IconTruck size={12}/>}
                />

                <Field
                  label="Status"
                  value={data?.status}
                  icon={<IconShield size={12}/>}
                />

                <Field
                  label="On Leave"
                  value={data?.onLeave ? "Yes" : "No"}
                  icon={<IconClock size={12}/>}
                />

                <Field
                  label="Black Listed"
                  value={data?.blackListed ? "Yes" : "No"}
                  icon={<IconBan size={12}/>}
                />

                <Field
                  label="Address"
                  value={data?.permanentAddress}
                  icon={<IconMapPin size={12}/>}
                />

              </div>

            </div>

            <div className="mx-5 border-t" />

            {/* System Info */}

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

          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <IconClockEdit size={12}/>
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