"use client";

import * as React from "react";
import type { AgreementWithRelations } from "@skerp/types";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";

import { Skeleton } from "@skerp/ui/components/skeleton";

import {
  IconBuilding,
  IconUser,
  IconMapPin,
  IconCalendar,
  IconTruck,
  IconScale,
  IconId,
} from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data?: AgreementWithRelations;
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

const formatDate = (value?: string | Date | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
};

export default function AgreementDetailDialog({
  open,
  onOpenChange,
  data,
  isLoading,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] w-[98vw] max-w-none overflow-hidden p-0 sm:max-w-[1100px]">
        
        {/* HEADER */}
        <div className="border-b bg-muted/30 px-6 py-5">
          <DialogHeader>
            <div className="flex items-center gap-4">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <IconBuilding size={22} />
              </span>

              <div>
                <DialogTitle className="text-lg font-semibold">
                  Agreement Details
                </DialogTitle>
                <DialogDescription>
                  Complete contract information between company and customer
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* BODY */}
        <div className="max-h-[calc(92vh-96px)] overflow-y-auto p-6">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 15 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-md" />
              ))}
            </div>
          ) : (
            <div className="grid gap-x-10 gap-y-0 md:grid-cols-2 xl:grid-cols-3">

              {/* ================= PARTIES ================= */}
              <DetailItem
                icon={<IconBuilding size={15} />}
                label="Company"
                value={data?.company?.name ?? "-"}
              />

              <DetailItem
                icon={<IconUser size={15} />}
                label="Customer"
                value={data?.client?.name ?? "-"}
              />

              {/* ================= LOCATION ================= */}
              <DetailItem
                icon={<IconMapPin size={15} />}
                label="City"
                value={data?.city?.name ?? "-"}
              />

              <DetailItem
                icon={<IconMapPin size={15} />}
                label="Branch"
                value={data?.branch?.name ?? "-"}
              />

              {/* ================= TIMELINE ================= */}
              <DetailItem
                icon={<IconCalendar size={15} />}
                label="Agreement Date"
                value={formatDate(data?.agreementDate)}
              />

              <DetailItem
                icon={<IconCalendar size={15} />}
                label="Start Date"
                value={formatDate(data?.startDate)}
              />

              <DetailItem
                icon={<IconCalendar size={15} />}
                label="Expiry Date"
                value={formatDate(data?.expiryDate)}
              />

              {/* ================= LOGISTICS ================= */}
              <DetailItem
                icon={<IconTruck size={15} />}
                label="Carrying Capacity"
                value={
                  data?.carryingCapacity != null
                    ? `${data.carryingCapacity} Ton`
                    : "-"
                }
              />

              <DetailItem
  icon={<IconId size={15} />}
  label="Agreement"
  value={`${data?.company?.name ?? "-"} - ${data?.client?.name ?? "-"}`}
/>
              {/* ================= SYSTEM ================= */}
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
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}