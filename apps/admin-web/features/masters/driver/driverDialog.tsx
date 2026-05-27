"use client";

import * as React from "react";
import type { Driver } from "@skerp/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  IconUser,
  IconPhone,
  IconId,
  IconCalendar,
  IconTruck,
  IconShield,
  IconBan,
  IconClock,
  IconMapPin,
} from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data?: Driver;
  isLoading?: boolean;
};

function DetailItem({
  icon,
  label,
  value,
  wide = false,
}: {
  icon: React.ReactNode;
  label: string;
  value?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={
        wide
          ? "grid gap-1 border-b py-4 md:col-span-2 xl:col-span-3"
          : "grid gap-1 border-b py-4"
      }
    >
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </div>

      <div className="break-words text-sm font-semibold leading-6 text-foreground">
        {value || "-"}
      </div>
    </div>
  );
}

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

export default function DriverDetailDialog({
  open,
  onOpenChange,
  data,
  isLoading,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] w-[98vw] max-w-none overflow-hidden p-0 sm:max-w-[1000px]">
        <div className="border-b bg-muted/30 px-6 py-5">
          <DialogHeader>
            <div className="flex items-center gap-4">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <IconTruck size={22} />
              </span>

              <div>
                <DialogTitle className="text-lg font-semibold">
                  Driver Detail
                </DialogTitle>
                <DialogDescription>
                  Complete driver profile, license and status information
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="max-h-[calc(92vh-96px)] overflow-y-auto p-6">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 15 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full rounded-md" />
              ))}
            </div>
          ) : (
            <div className="grid gap-x-10 gap-y-0 md:grid-cols-2 xl:grid-cols-3">
              <DetailItem
                icon={<IconUser size={15} />}
                label="Driver Name"
                value={data?.name}
              />

              <DetailItem
                icon={<IconPhone size={15} />}
                label="Mobile No"
                value={data?.mobileNo ?? "-"}
              />

              <DetailItem
                icon={<IconPhone size={15} />}
                label="Alternate Phone"
                value={data?.alternatePhone ?? "-"}
              />

              <DetailItem
                icon={<IconId size={15} />}
                label="License No"
                value={data?.licenseNo ?? "-"}
              />

              <DetailItem
                icon={<IconCalendar size={15} />}
                label="License Expiry"
                value={formatDate(data?.licenseExpiry)}
              />

              <DetailItem
                icon={<IconTruck size={15} />}
                label="Driver Type"
                value={data?.type ?? "-"}
              />

              <DetailItem
                icon={<IconShield size={15} />}
                label="Status"
                value={data?.status ?? "-"}
              />

              <DetailItem
                icon={<IconClock size={15} />}
                label="On Leave"
                value={data?.onLeave ? "Yes" : "No"}
              />

              <DetailItem
                icon={<IconBan size={15} />}
                label="Black Listed"
                value={data?.blackListed ? "Yes" : "No"}
              />

              <DetailItem
                icon={<IconCalendar size={15} />}
                label="Created At"
                value={formatDate(data?.createdAt)}
              />

              <DetailItem
                icon={<IconCalendar size={15} />}
                label="Updated At"
                value={formatDate(data?.updatedAt)}
              />

              <DetailItem
                icon={<IconMapPin size={15} />}
                label="Address"
                value={data?.address ?? "-"}
                wide
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}