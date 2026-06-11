"use client";

import * as React from "react";
import type { Branch } from "@skerp/types";

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
  IconBuildingStore,
  IconBuilding,
  IconMapPin,
  IconPhone,
  IconMail,
  IconId,
  IconClock,
  IconCalendar,
  IconHome,
  IconCircleCheckFilled,
  IconClockEdit,
} from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data?: Branch;
  isLoading?: boolean;
};

function SkeletonBody() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <Skeleton className="mb-3 h-4 w-28" />
        <Skeleton className="h-16 rounded-lg" />
      </div>

      <div>
        <Skeleton className="mb-3 h-4 w-28" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, index) => (
            <Skeleton key={index} className="h-14 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function BranchDetailDialog({
  open,
  onOpenChange,
  data,
  isLoading,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] !max-w-[1000px] h-[90vh] !max-h-[90vh] gap-0 overflow-hidden rounded-lg p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconBuildingStore size={20} />
            </span>

            <div>
              <p className="text-sm font-semibold">Branch Details</p>

              {!isLoading && data && (
                <div className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                  <IconCircleCheckFilled size={10} />
                  Active Branch
                </div>
              )}
            </div>
          </div>
        </div>

        {isLoading ? (
          <SkeletonBody />
        ) : (
          <div className="h-[calc(95vh-120px)] overflow-y-auto">
            {/* Branch Summary */}
            <div className="px-5 py-5">
              <SectionLabel>Branch Overview</SectionLabel>

              <PartyCard
                label="Branch"
                name={data?.name}
                subtitle={data?.company?.name}
                colorClass="bg-violet-100 text-violet-700"
                icon={<IconBuildingStore size={15} />}
              />
            </div>

            <div className="mx-5 border-t" />

            {/* Branch Information */}
            <div className="px-5 py-5">
              <SectionLabel>Branch Information</SectionLabel>

              <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                <Field
                  label="Branch Code"
                  value={data?.branchCode}
                  icon={<IconId size={12} />}
                />

                <Field
                  label="Short Code"
                  value={data?.shortCode}
                  icon={<IconId size={12} />}
                />

                <Field
                  label="Company"
                  value={data?.company?.name}
                  icon={<IconBuilding size={12} />}
                />

                <Field
                  label="City"
                  value={data?.city?.name}
                  icon={<IconMapPin size={12} />}
                />

                <Field
                  label="Contact Name"
                  value={data?.contactName}
                  icon={<IconPhone size={12} />}
                />

                <Field
                  label="Contact Phone"
                  value={data?.contactPhone}
                  icon={<IconPhone size={12} />}
                />

                <Field
                  label="Email"
                  value={data?.email}
                  icon={<IconMail size={12} />}
                />

                <Field
                  label="Weekly Off Day"
                  value={data?.weeklyOffDay}
                  icon={<IconCalendar size={12} />}
                />

                <Field
                  label="GST No"
                  value={data?.gstNo}
                  icon={<IconId size={12} />}
                />

                <Field
                  label="Working Hours"
                  value={data?.workingHours}
                  icon={<IconClock size={12} />}
                />

                <Field
                  label="Created At"
                  value={formatDate(data?.createdAt)}
                  icon={<IconCalendar size={12} />}
                />

                <Field
                  label="Updated At"
                  value={formatDate(data?.updatedAt)}
                  icon={<IconCalendar size={12} />}
                />

                <div className="col-span-3">
                  <Field
                    label="Address"
                    value={data?.address}
                    icon={<IconHome size={12} />}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t bg-muted/30 px-5 py-3">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <IconClockEdit size={12} />
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