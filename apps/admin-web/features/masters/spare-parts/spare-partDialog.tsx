"use client";

import * as React from "react";
import type { SparePart } from "@skerp/types";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";

import { Skeleton } from "@skerp/ui/components/skeleton";

import {
  IconTool,
  IconId,
  IconCategory,
  IconPackage,
  IconCurrencyRupee,
  IconFileText,
  IconCalendar,
  IconBarcode,
} from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data?: SparePart;
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

const formatCurrency = (
  value?: number | null
) => {
  if (value == null) return "-";

  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }
  ).format(value);
};

export default function SparePartDetailDialog({
  open,
  onOpenChange,
  data,
  isLoading,
}: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-h-[94vh] w-[98vw] max-w-none overflow-hidden p-0 sm:max-w-[1100px]">
        <div className="border-b bg-muted/30 px-6 py-5">
          <DialogHeader>
            <div className="flex items-center gap-4">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <IconTool size={22} />
              </span>

              <div>
                <DialogTitle className="text-lg font-semibold">
                  Spare Part Detail
                </DialogTitle>

                <DialogDescription>
                  Complete spare part information
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="max-h-[calc(92vh-96px)] overflow-y-auto p-6">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({
                length: 12,
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
                icon={
                  <IconTool size={15} />
                }
                label="Part Name"
                value={data?.name}
              />

              <DetailItem
                icon={<IconId size={15} />}
                label="Part Code"
                value={data?.code}
              />

              <DetailItem
                icon={
                  <IconCategory size={15} />
                }
                label="Category"
                value={
                  data?.category?.name
                }
              />

              <DetailItem
                icon={
                  <IconPackage size={15} />
                }
                label="Unit"
                value={
                  data?.unit?.name
                }
              />

              <DetailItem
                icon={
                  <IconCurrencyRupee size={15} />
                }
                label="Purchase Rate"
                value={formatCurrency(
                  data?.purchaseRate
                )}
              />

              <DetailItem
                icon={
                  <IconCurrencyRupee size={15} />
                }
                label="Selling Rate"
                value={formatCurrency(
                  data?.sellingRate
                )}
              />

              <DetailItem
                icon={
                  <IconBarcode size={15} />
                }
                label="HSN Code"
                value={data?.hsnCode}
              />

              <DetailItem
                icon={
                  <IconFileText size={15} />
                }
                label="Description"
                value={
                  data?.description
                }
                wide
              />

              <DetailItem
                icon={
                  <IconCalendar size={15} />
                }
                label="Created At"
                value={
                  data?.createdAt
                    ? new Date(
                        data.createdAt
                      ).toLocaleDateString()
                    : "-"
                }
              />

              <DetailItem
                icon={
                  <IconCalendar size={15} />
                }
                label="Updated At"
                value={
                  data?.updatedAt
                    ? new Date(
                        data.updatedAt
                      ).toLocaleDateString()
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