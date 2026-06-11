"use client";

import * as React from "react";
import type { Pump } from "@skerp/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  IconGasStation,
  IconMapPin,
  IconPhone,
  IconUser,
  IconCash,
  IconBan,
  IconId,
  IconCalendar,
  IconHome,
} from "@tabler/icons-react";
import { formatCurrency } from "../_shared/dialog-parts";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data?: Pump;
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
      <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </div>

      <div className="break-words text-sm font-semibold leading-6 text-foreground">
        {value || "-"}
      </div>
    </div>
  );
}

export default function PumpDetailDialog({
  open,
  onOpenChange,
  data,
  isLoading,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] w-[98vw] max-w-none overflow-hidden p-0 sm:max-w-[1100px]">
        <div className="border-b bg-muted/30 px-6 py-5">
          <DialogHeader>
            <div className="flex items-center gap-4">
              <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <IconGasStation size={22} />
              </span>

              <div>
                <DialogTitle className="text-lg font-semibold">
                  Pump Detail
                </DialogTitle>
                <DialogDescription>
                  Complete pump profile, fuel pricing and contact information
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="max-h-[calc(92vh-96px)] overflow-y-auto p-6">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 18 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full rounded-md" />
              ))}
            </div>
          ) : (
            <div className="grid gap-x-10 gap-y-0 md:grid-cols-2 xl:grid-cols-3">
              <DetailItem
                icon={<IconGasStation size={15} />}
                label="Pump Name"
                value={data?.name}
              />

           
            <DetailItem
  icon={<IconUser size={15} />}
  label="Contact Person"
  value={data?.contactName ?? "-"}
/>

              <DetailItem
                icon={<IconPhone size={15} />}
                label="Contact Phone"
                value={data?.contactPhone ?? "-"}
              />

              <DetailItem
                icon={<IconMapPin size={15} />}
                label="Address"
                value={data?.address ?? "-"}
              />

              <DetailItem
                icon={<IconMapPin size={15} />}
                label="City"
                value={data?.city?.name ?? "-"}
              />

              <DetailItem
                icon={<IconMapPin size={15} />}
                label="State"
                value={data?.state?.name ?? "-"}
              />

              <DetailItem
                icon={<IconHome size={15} />}
                label="Country"
                value={data?.country ?? "-"}
              />

              <DetailItem
                icon={<IconCash size={15} />}
                label="Current Diesel Rate"
                value={formatCurrency(data?.currentDieselRate)}
              />

              <DetailItem
                icon={<IconCalendar size={15} />}
                label="Rate Last Updated"
                value={
                  data?.rateLastUpdated
                    ? new Date(data.rateLastUpdated).toLocaleDateString()
                    : "-"
                }
              />

              <DetailItem
                icon={<IconId size={15} />}
                label="GSTIN"
                value={data?.gstIn ?? "-"}
              />

              <DetailItem
                icon={<IconId size={15} />}
                label="PAN"
                value={data?.pan ?? "-"}
              />

              <DetailItem
                icon={<IconCash size={15} />}
                label="Credit Limit"
                value={formatCurrency(data?.creditLimit)}
              />

              <DetailItem
                icon={<IconBan size={15} />}
                label="Blacklisted"
                value={data?.isBlackListed ? "Yes" : "No"}
              />

              <DetailItem
                icon={<IconCalendar size={15} />}
                label="Created At"
                value={
                  data?.createdAt
                    ? new Date(data.createdAt).toLocaleDateString()
                    : "-"
                }
              />

              <DetailItem
                icon={<IconCalendar size={15} />}
                label="Updated At"
                value={
                  data?.updatedAt
                    ? new Date(data.updatedAt).toLocaleDateString()
                    : "-"
                }
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}