"use client";

import * as React from "react";
import type { Transport } from "@skerp/types";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";

import { Skeleton } from "@skerp/ui/components/skeleton";

import {
  IconTruck,
  IconMapPin,
  IconBuildingWarehouse,
} from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data?: Transport;
  isLoading?: boolean;
};

function DetailItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 border-b py-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span className="text-primary">
          {icon}
        </span>

        {label}
      </div>

      <div className="break-words text-sm font-semibold text-foreground">
        {value || "-"}
      </div>
    </div>
  );
}

export default function TransportDetailDialog({
  open,
  onOpenChange,
  data,
  isLoading,
}: Props) {
  console.log(data,'transpotrr')
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-h-[94vh] w-[98vw] max-w-none overflow-hidden p-0 sm:max-w-[1000px]">
        <div className="border-b bg-muted/30 px-6 py-5">
          <DialogHeader>
            <div className="flex items-center gap-4">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <IconTruck size={22} />
              </span>

              <div>
                <DialogTitle className="text-lg font-semibold">
                  Transport Detail
                </DialogTitle>

                <DialogDescription>
                  Complete transport information
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="max-h-[calc(92vh-96px)] overflow-y-auto p-6">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({
                length: 6,
              }).map((_, index) => (
                <Skeleton
                  key={index}
                  className="h-20 w-full rounded-md"
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-x-10 gap-y-0 md:grid-cols-2 xl:grid-cols-3">

              <DetailItem
                icon={<IconTruck size={15} />}
                label="Transport Name"
                value={data?.name}
              />

              <DetailItem
                icon={
                  <IconBuildingWarehouse size={15} />
                }
                label="State"
                value={data?.state?.name}
              />

              <DetailItem
                icon={<IconMapPin size={15} />}
                label="City"
                value={data?.city?.name}
              />

        

         
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}