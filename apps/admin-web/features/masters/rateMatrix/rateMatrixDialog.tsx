"use client";

import * as React from "react";
import type {  RateMatrixWithRelations } from "@skerp/types";
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
  IconFileInvoice,
  IconCurrencyRupee,
  IconClock,
  IconNotes,
} from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data?: RateMatrixWithRelations;
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
  }).format(value);
};

export default function RateMatrixDetailDialog({
  open,
  onOpenChange,
  data,
  isLoading,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] w-[98vw] max-w-none overflow-hidden p-0 sm:max-w-[1100px]">
        {/* HEADER */}
    <div className="border-b bg-gradient-to-r from-primary/10 via-muted/40 to-background px-6 py-5">
  <DialogHeader>
    <div className="flex items-center gap-4">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
        <IconFileInvoice size={24} />
      </span>

      <div>
        <DialogTitle className="text-xl font-semibold">
          Rate Matrix Detail
        </DialogTitle>
        <DialogDescription>
          Route-wise pricing linked with agreement details
        </DialogDescription>
      </div>
    </div>
  </DialogHeader>
</div>

        {/* BODY */}
        <div className="max-h-[calc(92vh-96px)] overflow-y-auto p-6">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 12 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full rounded-md" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <DetailItem
  icon={<IconFileInvoice size={16} />}
  label="Agreement"
  value={`${data?.agreement?.company?.name ?? "-"} - ${
    data?.agreement?.client?.name ?? "-"
  }`}
/>

            <DetailItem
  icon={<IconRoute size={16} />}
  label="Route"
  value={`${data?.route?.sourceCity?.name ?? "-"} to ${
    data?.route?.destinationCity?.name ?? "-"
  }`}
/>

              <DetailItem
                icon={<IconCurrencyRupee size={16} />}
                label="Rate"
                value={formatCurrency(data?.rate)}
              />

              <DetailItem
                icon={<IconClock size={16} />}
                label="Transit Days"
                value={
                  data?.transitDays != null
                    ? `${data.transitDays} days`
                    : "-"
                }
              />

              <DetailItem
                icon={<IconNotes size={16}/>}
                label="Remarks"
                value={data?.remarks}
                wide
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}