"use client";

import * as React from "react";
import type { Customer } from "@skerp/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  IconBuildingStore,
  IconMapPin,
  IconPhone,
  IconMail,
  IconId,
  IconCalendar,
  IconHome,
  IconWorld,
  IconCash,
  IconPercentage,
  IconBan,
  IconUser,
} from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data?: Customer;
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

export default function CustomerDetailDialog({
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
                <IconBuildingStore size={22} />
              </span>

              <div>
                <DialogTitle className="text-lg font-semibold">
                  Customer Detail
                </DialogTitle>
                <DialogDescription>
                  Complete customer profile, billing and contact information
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
                icon={<IconBuildingStore size={15} />}
                label="Customer Name"
                value={data?.name}
              />

              <DetailItem
                icon={<IconId size={15} />}
                label="Short Name"
                value={data?.shortName ?? "-"}
              />

              <DetailItem
                icon={<IconId size={15} />}
                label="PAN No"
                value={data?.customerPAN ?? "-"}
              />

              <DetailItem
                icon={<IconId size={15} />}
                label="GSTIN"
                value={data?.gstNo ?? "-"}
              />

              <DetailItem
                icon={<IconCash size={15} />}
                label="Credit Limit"
                value={formatCurrency(data?.creditLimit)}
              />

              <DetailItem
                icon={<IconPercentage size={15} />}
                label="Late Payment Interest %"
                value={
                  data?.interestRateLatePayment != null
                    ? `${data.interestRateLatePayment}%`
                    : "-"
                }
              />

              <DetailItem
                icon={<IconPercentage size={15} />}
                label="TDS Deduction %"
                value={
                  data?.tdsDeductionRate != null
                    ? `${data.tdsDeductionRate}%`
                    : "-"
                }
              />

              <DetailItem
                icon={<IconMapPin size={15} />}
                label="Country"
                value={data?.country ?? "-"}
              />

              <DetailItem
                icon={<IconMapPin size={15} />}
                label="State"
                value={data?.state?.name ?? "-"}
              />

              <DetailItem
                icon={<IconMapPin size={15} />}
                label="City"
                value={data?.city?.name ?? "-"}
              />

              <DetailItem
                icon={<IconUser size={15} />}
                label="Contact Person"
                value={data?.contactPerson ?? "-"}
              />

              <DetailItem
                icon={<IconPhone size={15} />}
                label="Contact Phone"
                value={data?.contactPhone ?? "-"}
              />

              <DetailItem
                icon={<IconPhone size={15} />}
                label="Mobile No"
                value={data?.mobileNo ?? "-"}
              />

              <DetailItem
                icon={<IconMail size={15} />}
                label="Primary Email"
                value={data?.primaryEmail ?? "-"}
              />

              <DetailItem
                icon={<IconWorld size={15} />}
                label="Website"
                value={data?.website ?? "-"}
              />

              <DetailItem
                icon={<IconBan size={15} />}
                label="Disallow New LR Booking"
                value={data?.disallowNewLRBooking ? "Yes" : "No"}
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

              <DetailItem
                icon={<IconHome size={15} />}
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