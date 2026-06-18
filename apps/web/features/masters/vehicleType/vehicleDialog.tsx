"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";

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
  IconCalendar,
  IconClockEdit,
  IconCircleCheckFilled,
  IconCalendarCheck,
} from "@tabler/icons-react";

import { vehicleTypeApi } from "./vehicleType.service";
import { vehicleTypeKeys } from "./vehicleType.key";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  id?: string | null;
};

export default function VehicleTypeDetailDialog({
  open,
  onOpenChange,
  id,
}: Props) {
  const detail = useQuery({
    queryKey: id
      ? vehicleTypeKeys.detail(id)
      : ["vehicle-type-detail-empty"],
    queryFn: () => vehicleTypeApi.detail(id!),
    enabled: Boolean(open && id),
  });

  const data = detail.data;
  const isLoading = detail.isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] !max-w-[800px] h-[80vh] !max-h-[80vh] gap-0 overflow-hidden rounded-lg p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconTruck size={20} />
            </span>

            <div>
              <DialogTitle>Vehicle Type Details</DialogTitle>

              {!isLoading && data && (
                <div className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                  <IconCircleCheckFilled size={10} />
                  Active Record
                </div>
              )}
            </div>
          </div>
        </div>

        {isLoading ? (
          <SkeletonBody />
        ) : (
          <div className="h-[calc(80vh-120px)] overflow-y-auto p-2">
            {/* Vehicle Type Information */}
            <div className="px-5 py-5">
              <SectionLabel>Vehicle Type Information</SectionLabel>

              <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
                <Field
                  label="Code"
                  value={data?.code}
                  icon={<IconTruck size={12} />}
                />

                <Field
                  label="Name"
                  value={data?.name}
                  icon={<IconTruck size={12} />}
                />

                <Field
                  label="Freight Range From"
                  value={data?.freightRangeFrom}
                  icon={<IconTruck size={12} />}
                />

                <Field
                  label="Freight Range To"
                  value={data?.freightRangeTo}
                  icon={<IconTruck size={12} />}
                />
              </div>
            </div>

            <div className="mx-5 border-t" />

            {/* System Information */}
            <div className="px-5 py-5">
              <SectionLabel>System Information</SectionLabel>

              <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
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
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <IconCalendarCheck size={12} />
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