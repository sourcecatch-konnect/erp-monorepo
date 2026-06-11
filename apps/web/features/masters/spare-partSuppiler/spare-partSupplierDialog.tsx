"use client";

import * as React from "react";
import type { SparePartSupplier } from "@skerp/types";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@skerp/ui/components/dialog";

import { Skeleton } from "@skerp/ui/components/skeleton";

import {
  SectionLabel,
  Field,
  formatDate,
  SkeletonBody,
} from "../_shared/dialog-parts";

import {
  IconTruck,
  IconUser,
  IconBuildingStore,
  IconMapPin,
  IconPhone,
  IconMail,
  IconId,
  IconCalendar,
  IconHome,
  IconCircleCheckFilled,
  IconClockEdit,
} from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data?: SparePartSupplier;
  isLoading?: boolean;
};


<<<<<<< HEAD:apps/web/features/masters/spare-partSuppiler/spare-partSupplierDialog.tsx
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, x) => (
              <Skeleton
                key={x}
                className="h-14 rounded-lg"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
=======
>>>>>>> 2d56891e7d1cc1580b6573a5bec34ea840b7ab08:apps/admin-web/features/masters/spare-partSuppiler/spare-partSupplierDialog.tsx

export default function SparePartSupplierDetailDialog({
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
        className="w-[92vw] !max-w-[1000px] h-[90vh] !max-h-[90vh] gap-0 overflow-hidden rounded-lg p-0"
      >

        {/* Header */}

        <div className="flex items-center justify-between border-b px-5 py-4">

          <div className="flex items-center gap-3">

            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconTruck size={20}/>
            </span>

            <div>
         
              <DialogTitle>Spare Part Supplier Details</DialogTitle>
              {!isLoading && data && (
                <div className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                  <IconCircleCheckFilled size={10}/>
                  Active Supplier
                </div>
              )}
            </div>

          </div>

        </div>

        {isLoading ? (
          <SkeletonBody/>
        ) : (
          <div className="h-[calc(90vh-120px)] overflow-y-auto">

            {/* Overview */}

            <div className="px-5 py-5">

              <SectionLabel>
                Supplier Overview
              </SectionLabel>

              <div className="rounded-lg border p-4">

                <div className="flex items-center gap-3">

                  <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <IconTruck size={18}/>
                  </span>

                  <div>
                    <p className="font-medium">
                      {data?.name ?? "-"}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {data?.shopName ?? "-"}
                    </p>
                  </div>

                </div>

              </div>

            </div>

            <div className="mx-5 border-t"/>

            {/* Supplier Information */}

            <div className="px-5 py-5">

              <SectionLabel>
                Supplier Information
              </SectionLabel>

              <div className="grid grid-cols-3 gap-x-6 gap-y-4">

                <Field
                  label="Supplier Name"
                  value={data?.name}
                  icon={<IconTruck size={12}/>}
                />

                <Field
                  label="Supplier Type"
                  value={data?.type}
                  icon={<IconId size={12}/>}
                />

                <Field
                  label="Shop Name"
                  value={data?.shopName}
                  icon={<IconBuildingStore size={12}/>}
                />

                <Field
                  label="City"
                  value={data?.city?.name}
                  icon={<IconMapPin size={12}/>}
                />

                <Field
                  label="Contact Person"
                  value={data?.contactPerson}
                  icon={<IconUser size={12}/>}
                />

                <Field
                  label="Contact Phone"
                  value={data?.contactPhone}
                  icon={<IconPhone size={12}/>}
                />

                <Field
                  label="Mobile No"
                  value={data?.mobileNo}
                  icon={<IconPhone size={12}/>}
                />

                <Field
                  label="Email"
                  value={data?.email}
                  icon={<IconMail size={12}/>}
                />

                <Field
                  label="PAN Number"
                  value={data?.panNo}
                  icon={<IconId size={12}/>}
                />

                <Field
                  label="GSTIN"
                  value={data?.gstin}
                  icon={<IconId size={12}/>}
                />

                <Field
                  label="Address"
                  value={data?.address}
                  icon={<IconHome size={12}/>}
                />

              </div>

            </div>

            <div className="mx-5 border-t"/>

            {/* System Information */}

            <div className="px-5 py-5">

              <SectionLabel>
                System Information
              </SectionLabel>

              <div className="grid grid-cols-3 gap-x-6 gap-y-4">

                <Field
                  label="Created At"
                  value={formatDate(data?.createdAt)}
                  icon={<IconCalendar size={12}/>}
                />

                <Field
                  label="Updated At"
                  value={formatDate(data?.updatedAt)}
                  icon={<IconClockEdit size={12}/>}
                />

              </div>

            </div>

          </div>
        )}

        {/* Footer */}

        <div className="flex items-center justify-between border-t bg-muted/30 px-5 py-3">

          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <IconClockEdit size={12}/>
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