"use client";

import * as React from "react";
import type { RailwayFreightMatrix } from "@skerp/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { Skeleton } from "@skerp/ui/components/skeleton";

import {
  IconTrain,
  IconMapPin,
  IconArrowRight,
  IconCash,
  IconId,
  IconCalendar,
} from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data?: RailwayFreightMatrix;
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

const formatCurrency = (value?: number | null) => {
  if (value == null) return "-";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
};

export default function RailwayFreightDetailDialog({
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
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <IconTrain size={22} />
              </span>

              <div>
                <DialogTitle className="text-lg font-semibold">
                  Railway Freight Detail
                </DialogTitle>
                <DialogDescription>
                  Wagon type, route and freight charge information
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="max-h-[calc(92vh-96px)] overflow-y-auto p-6">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 12 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full rounded-md" />
              ))}
            </div>
          ) : (
            <div className="grid gap-x-10 gap-y-0 md:grid-cols-2 xl:grid-cols-3">
              <DetailItem
                icon={<IconTrain size={15} />}
                label="Wagon Type"
                value={data?.wagonType}
              />

              <DetailItem
                icon={<IconMapPin size={15} />}
                label="Source City"
                value={data?.sourceCity?.name ?? "-"}
              />

              <DetailItem
                icon={<IconArrowRight size={15} />}
                label="Destination City"
                value={data?.destinationCity?.name ?? "-"}
              />

              <DetailItem
                icon={<IconCash size={15} />}
                label="Freight Amount"
                value={formatCurrency(data?.freightAmount)}
              />

              <DetailItem
                icon={<IconId size={15} />}
                label="Wagon Reference"
                value={data?.wagon?.name ?? data?.wagonType ?? "-"}
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