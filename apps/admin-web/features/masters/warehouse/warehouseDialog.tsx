"use client";

import * as React from "react";
import type { WarehouseWithRelations } from "@skerp/types";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";

import { Skeleton } from "@skerp/ui/components/skeleton";

import {
  IconBuildingWarehouse,
  IconMapPin,
  IconPhone,
  IconUser,
  IconCalendar,
  IconRuler,
  IconCash,
  IconDoor,
} from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data?: WarehouseWithRelations;
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
    }
  ).format(value);
};

export default function WarehouseDetailDialog({
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
                <IconBuildingWarehouse
                  size={22}
                />
              </span>

              <div>
                <DialogTitle className="text-lg font-semibold">
                  Warehouse Detail
                </DialogTitle>

                <DialogDescription>
                  Complete warehouse information
                </DialogDescription>
              </div>

            </div>
          </DialogHeader>
        </div>

        <div className="max-h-[calc(92vh-96px)] overflow-y-auto p-6">

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">

              {Array.from({
                length: 16,
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
                  <IconBuildingWarehouse size={15} />
                }
                label="Warehouse Name"
                value={data?.name}
              />

              <DetailItem
                icon={
                  <IconBuildingWarehouse size={15} />
                }
                label="Type"
                value={data?.type}
              />

              <DetailItem
                icon={
                  <IconBuildingWarehouse size={15} />
                }
                label="Branch"
                value={data?.branch?.name}
              />

              <DetailItem
                icon={<IconMapPin size={15} />}
                label="City"
                value={data?.city?.name}
              />

              <DetailItem
                icon={<IconMapPin size={15} />}
                label="State"
                value={data?.state?.name}
              />

              <DetailItem
                icon={<IconMapPin size={15} />}
                label="Country"
                value={data?.country}
              />

              <DetailItem
                icon={<IconUser size={15} />}
                label="Contact Person"
                value={data?.contactName}
              />

              <DetailItem
                icon={<IconPhone size={15} />}
                label="Contact Phone"
                value={data?.contactPhone}
              />

              <DetailItem
                icon={<IconCash size={15} />}
                label="Monthly Rent"
                value={formatCurrency(
                  data?.monthlyRent
                )}
              />

              <DetailItem
                icon={<IconCash size={15} />}
                label="Security Deposit"
                value={formatCurrency(
                  data?.securityDeposit
                )}
              />

              <DetailItem
                icon={<IconRuler size={15} />}
                label="Length"
                value={data?.length}
              />

              <DetailItem
                icon={<IconRuler size={15} />}
                label="Width"
                value={data?.width}
              />

              <DetailItem
                icon={<IconRuler size={15} />}
                label="Breadth"
                value={data?.breadth}
              />

              <DetailItem
                icon={<IconDoor size={15} />}
                label="Gate No"
                value={data?.gateNo}
              />

              <DetailItem
                icon={
                  <IconBuildingWarehouse size={15} />
                }
                label="Storage Capacity"
                value={data?.storageCapacity}
              />

              <DetailItem
                icon={<IconCalendar size={15} />}
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
                icon={<IconMapPin size={15} />}
                label="Address"
                value={data?.address}
                wide
              />

            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}