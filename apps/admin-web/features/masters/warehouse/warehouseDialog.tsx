"use client";

import * as React from "react";
import type { WarehouseWithRelations } from "@skerp/types";

import {
  Dialog,
  DialogContent,
} from "@skerp/ui/components/dialog";

import { Skeleton } from "@skerp/ui/components/skeleton";

import {
  SectionLabel,
  Field,
  PartyCard,
  formatDate,
  formatCurrency,
} from "../_shared/dialog-parts";

import {
  IconBuildingWarehouse,
  IconMapPin,
  IconPhone,
  IconUser,
  IconCalendar,
  IconRuler,
  IconCash,
  IconDoor,
  IconCircleCheckFilled,
  IconClockEdit,
  IconCalendarCheck,
} from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data?: WarehouseWithRelations;
  isLoading?: boolean;
};

function SkeletonBody() {
  return (
    <div className="space-y-6 p-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i}>
          <Skeleton className="mb-3 h-4 w-28" />

          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, x) => (
              <Skeleton
                key={x}
                className="h-14 rounded-xl"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}


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
      <DialogContent
        className="w-[92vw] !max-w-[1000px] h-[90vh] !max-h-[90vh] gap-0 overflow-hidden rounded-2xl p-0"
      >

        {/* Header */}

        <div className="flex items-center justify-between border-b px-5 py-4">

          <div className="flex items-center gap-3">

            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconBuildingWarehouse size={20}/>
            </span>

            <div>
              <p className="text-sm font-semibold">
                Warehouse Details
              </p>

              {!isLoading && data && (
                <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600">
                  <IconCircleCheckFilled size={10}/>
                  Active Warehouse
                </div>
              )}
            </div>

          </div>

        </div>

        {isLoading ? (
          <SkeletonBody />
        ) : (
          <div className="h-[calc(90vh-120px)] overflow-y-auto">

            {/* Overview */}

            <div className="px-5 py-5">

              <SectionLabel>
                Warehouse Overview
              </SectionLabel>

              <PartyCard
                label="Warehouse"
                name={data?.name}
                subtitle={data?.branch?.name}
                colorClass="bg-orange-100 text-orange-700"
                icon={
                  <IconBuildingWarehouse
                    size={15}
                  />
                }
              />

            </div>

            <div className="mx-5 border-t"/>

            {/* Information */}

            <div className="px-5 py-5">

              <SectionLabel>
                Warehouse Information
              </SectionLabel>

              <div className="grid grid-cols-3 gap-x-6 gap-y-4">

                <Field
                  label="Type"
                  value={data?.type}
                  icon={<IconBuildingWarehouse size={12}/>}
                />

                <Field
                  label="Branch"
                  value={data?.branch?.name}
                  icon={<IconBuildingWarehouse size={12}/>}
                />

                <Field
                  label="City"
                  value={data?.city?.name}
                  icon={<IconMapPin size={12}/>}
                />

                <Field
                  label="State"
                  value={data?.state?.name}
                  icon={<IconMapPin size={12}/>}
                />

                <Field
                  label="Country"
                  value={data?.country}
                  icon={<IconMapPin size={12}/>}
                />

                <Field
                  label="Contact Person"
                  value={data?.contactName}
                  icon={<IconUser size={12}/>}
                />

                <Field
                  label="Contact Phone"
                  value={data?.contactPhone}
                  icon={<IconPhone size={12}/>}
                />

                <Field
                  label="Monthly Rent"
                  value={formatCurrency(
                    data?.monthlyRent
                  )}
                  icon={<IconCash size={12}/>}
                />

                <Field
                  label="Security Deposit"
                  value={formatCurrency(
                    data?.securityDeposit
                  )}
                  icon={<IconCash size={12}/>}
                />

                <Field
                  label="Length"
                  value={data?.length}
                  icon={<IconRuler size={12}/>}
                />

                <Field
                  label="Width"
                  value={data?.width}
                  icon={<IconRuler size={12}/>}
                />

                <Field
                  label="Breadth"
                  value={data?.breadth}
                  icon={<IconRuler size={12}/>}
                />

                <Field
                  label="Gate No"
                  value={data?.gateNo}
                  icon={<IconDoor size={12}/>}
                />

                <Field
                  label="Storage Capacity"
                  value={data?.storageCapacity}
                  icon={<IconBuildingWarehouse size={12}/>}
                />

                <Field
                  label="Address"
                  value={data?.address}
                  icon={<IconMapPin size={12}/>}
                />

              </div>

            </div>

            <div className="mx-5 border-t"/>

            {/* System */}

            <div className="px-5 py-5">

              <SectionLabel>
                System Information
              </SectionLabel>

              <div className="grid grid-cols-3 gap-x-6 gap-y-4">

                <Field
                  label="Created At"
                  value={formatDate(
                    data?.createdAt
                  )}
                  icon={<IconCalendar size={12}/>}
                />

                <Field
                  label="Updated At"
                  value={formatDate(
                    data?.updatedAt
                  )}
                  icon={<IconClockEdit size={12}/>}
                />

              </div>

            </div>

          </div>
        )}

        {/* Footer */}

        <div className="flex items-center justify-between border-t bg-muted/30 px-5 py-3">

 
 <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <IconCalendarCheck size={12} />
            Updated {formatDate(data?.updatedAt)}
          </span>

          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg border px-4 py-1.5 text-xs"
          >
            Close
          </button>

        </div>

      </DialogContent>
    </Dialog>
  );
}
