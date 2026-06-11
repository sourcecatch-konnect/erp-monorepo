"use client";

import * as React from "react";

import type {
  LabourWithRelations,
} from "@skerp/types";

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
  IconCalendar,
  IconCash,
  IconFileCertificate,
  IconHome,
  IconMapPin,
  IconPhone,
  IconUser,
  IconTool,
} from "@tabler/icons-react";
import { formatCurrency } from "../_shared/dialog-parts";

type Props = {
  open: boolean;
  onOpenChange: (
    value: boolean
  ) => void;

  data?: LabourWithRelations;

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

      <div className="break-words text-sm font-semibold leading-6">
        {value || "-"}
      </div>
    </div>
  );
}




const formatDate = (
  value?: Date | string | null
) => {
  if (!value)
    return "-";

  return new Date(
    value
  ).toLocaleDateString();
};

export default function LabourDetailDialog({
  open,
  onOpenChange,
  data,
  isLoading,
}: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={
        onOpenChange
      }
    >
      <DialogContent className="max-h-[94vh] w-[98vw] max-w-none overflow-hidden p-0 sm:max-w-[1100px]">
        <div className="border-b bg-muted/30 px-6 py-5">
          <DialogHeader>
            <div className="flex items-center gap-4">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <IconUser
                  size={22}
                />
              </span>

              <div>
                <DialogTitle className="text-lg font-semibold">
                  Labour Detail
                </DialogTitle>

                <DialogDescription>
                  Complete labour profile and work information
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
              }).map(
                (
                  _,
                  index
                ) => (
                  <Skeleton
                    key={
                      index
                    }
                    className="h-20 w-full rounded-md"
                  />
                )
              )}
            </div>
          ) : (
            <div className="grid gap-x-10 gap-y-0 md:grid-cols-2 xl:grid-cols-3">

              <DetailItem
                icon={
                  <IconUser size={15}/>
                }
                label="Name"
                value={
                  data?.name
                }
              />

              <DetailItem
                icon={
                  <IconTool size={15}/>
                }
                label="Worker Type"
                value={
                  data?.type
                }
              />

              <DetailItem
                icon={
                  <IconBuilding size={15}/>
                }
                label="Branch"
                value={
                  data?.branch
                    ?.name
                }
              />

              <DetailItem
                icon={
                  <IconMapPin size={15}/>
                }
                label="City"
                value={
                  data?.city
                    ?.name
                }
              />

              <DetailItem
                icon={
                  <IconUser size={15}/>
                }
                label="Contact Name"
                value={
                  data?.contactName
                }
              />

              <DetailItem
                icon={
                  <IconPhone size={15}/>
                }
                label="Contact Phone"
                value={
                  data?.contactPhone
                }
              />

              <DetailItem
                icon={
                  <IconPhone size={15}/>
                }
                label="Mobile"
                value={
                  data?.mobileNo
                }
              />

              <DetailItem
                icon={
                  <IconUser size={15}/>
                }
                label="Referred By"
                value={
                  data?.referredBy
                }
              />

              <DetailItem
                icon={
                  <IconPhone size={15}/>
                }
                label="Reference Contact"
                value={
                  data?.refContactNo
                }
              />

              <DetailItem
                icon={
                  <IconFileCertificate size={15}/>
                }
                label="PAN"
                value={
                  data?.pan
                }
              />

              <DetailItem
                icon={
                  <IconCash size={15}/>
                }
                label="TDS Amount"
                value={formatCurrency(
                  data?.tdsAmount
                )}
              />

              <DetailItem
                icon={
                  <IconCash size={15}/>
                }
                label="TDS Rate"
                value={
                  data?.tdsRate !=
                  null
                    ? `${data.tdsRate}%`
                    : "-"
                }
              />

              <DetailItem
                icon={
                  <IconCalendar size={15}/>
                }
                label="Start Date"
                value={formatDate(
                  data?.startDate
                )}
              />

              <DetailItem
                icon={
                  <IconCalendar size={15}/>
                }
                label="Created At"
                value={formatDate(
                  data?.createdAt
                )}
              />

              <DetailItem
                icon={
                  <IconCalendar size={15}/>
                }
                label="Updated At"
                value={formatDate(
                  data?.updatedAt
                )}
              />

              <DetailItem
                icon={
                  <IconHome size={15}/>
                }
                label="Address"
                value={
                  data?.address
                }
                wide
              />

            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}