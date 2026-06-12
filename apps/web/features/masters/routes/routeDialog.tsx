"use client";

import * as React from "react";
import type { Route } from "@skerp/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  IconRoute,
  IconMapPin,
  IconId,
  IconTruck,
  IconReceipt,
  IconCash,
} from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data?: Route;
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

export default function RouteDetailDialog({
  open,
  onOpenChange,
  data,
  isLoading,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] w-[98vw] max-w-none overflow-hidden p-0 sm:max-w-[900px]">
        <div className="border-b bg-muted/30 px-6 py-5">
          <DialogHeader>
            <div className="flex items-center gap-4">
              <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <IconRoute size={22} />
              </span>

              <div>
                <DialogTitle className="text-lg font-semibold">
                  Route Detail
                </DialogTitle>
                <DialogDescription>
                  Complete route information with linked trip and LR details
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="max-h-[calc(92vh-96px)] overflow-y-auto p-6">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 7 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full rounded-md" />
              ))}
            </div>
          ) : (
            <div className="grid gap-x-10 gap-y-0 md:grid-cols-2 xl:grid-cols-3">
              <DetailItem
                icon={<IconMapPin size={15} />}
                label="From City"
                value={data?.sourceCity?.name ?? "-"}
              />

              <DetailItem
                icon={<IconMapPin size={15} />}
                label="To City"
                value={data?.destinationCity?.name ?? "-"}
              />

              <DetailItem
                icon={<IconId size={15} />}
                label="Source City ID"
                value={data?.sourceCityId ?? "-"}
              />

              <DetailItem
                icon={<IconId size={15} />}
                label="Destination City ID"
                value={data?.destinationCityId ?? "-"}
              />

              <DetailItem
                icon={<IconCash size={15} />}
                label="Rate Matrices"
                value={data?.rateMatrixEntries?.length ?? 0}
              />

              <DetailItem
                icon={<IconTruck size={15} />}
                label="Trips"
                value={data?.VehicleTrip?.length ?? 0}
              />

              <DetailItem
                icon={<IconReceipt size={15} />}
                label="LR Count"
                value={data?.LorryReceipt?.length ?? 0}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}