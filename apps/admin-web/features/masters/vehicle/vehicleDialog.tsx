"use client";

import * as React from "react";
import type { Vehicle } from "@skerp/types";
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
  IconId,
  IconCalendar,
  IconGauge,
  IconShieldCheck,
  IconRuler,
  IconCircleDot,
} from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data?: Vehicle;
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

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  return new Date(value).toLocaleDateString();
}

export default function VehicleDetailDialog({
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
                <IconTruck size={22} />
              </span>

              <div>
                <DialogTitle className="text-lg font-semibold">
                  Vehicle Detail
                </DialogTitle>
                <DialogDescription>
                  Complete vehicle profile, registration and insurance information
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
                icon={<IconTruck size={15} />}
                label="Vehicle Number"
                value={data?.vehicleNumber}
              />

              <DetailItem
                icon={<IconId size={15} />}
                label="Chasis Number"
                value={data?.chasisNumber ?? "-"}
              />

              <DetailItem
                icon={<IconId size={15} />}
                label="Engine Number"
                value={data?.engineNumber ?? "-"}
              />

              <DetailItem
                icon={<IconTruck size={15} />}
                label="Ownership Type"
                value={data?.ownershipType ?? "-"}
              />

              <DetailItem
                icon={<IconTruck size={15} />}
                label="Vehicle Type"
                value={data?.vehicleType ?? "-"}
              />

              <DetailItem
                icon={<IconGauge size={15} />}
                label="Capacity MT"
                value={data?.capacityMT ?? "-"}
              />

              <DetailItem
                icon={<IconCircleDot size={15} />}
                label="Wheels"
                value={data?.wheels ?? "-"}
              />

              <DetailItem
                icon={<IconTruck size={15} />}
                label="Body Type"
                value={data?.bodyType ?? "-"}
              />

              <DetailItem
                icon={<IconRuler size={15} />}
                label="Length Feet"
                value={data?.lengthFeet ?? "-"}
              />

              <DetailItem
                icon={<IconGauge size={15} />}
                label="Opening KM"
                value={data?.openingKM ?? "-"}
              />

              <DetailItem
                icon={<IconGauge size={15} />}
                label="Current KM"
                value={data?.currentKM ?? "-"}
              />

              <DetailItem
                icon={<IconCalendar size={15} />}
                label="Purchase Date"
                value={formatDate(data?.purchaseDate)}
              />

              <DetailItem
                icon={<IconShieldCheck size={15} />}
                label="Insurance Number"
                value={data?.insuranceNumber ?? "-"}
              />

              <DetailItem
                icon={<IconShieldCheck size={15} />}
                label="Insurance Company"
                value={data?.insuranceCompany ?? "-"}
              />

              <DetailItem
                icon={<IconCalendar size={15} />}
                label="Insurance Issue Date"
                value={formatDate(data?.insuranceIssueDate)}
              />

              <DetailItem
                icon={<IconCalendar size={15} />}
                label="Insurance Due Date"
                value={formatDate(data?.insuranceDueDate)}
              />

              <DetailItem
                icon={<IconTruck size={15} />}
                label="Status"
                value={data?.status ?? "-"}
              />

              <DetailItem
                icon={<IconId size={15} />}
                label="ID"
                value={
                  <span className="font-mono text-xs">
                    {data?.id ?? "-"}
                  </span>
                }
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}