"use client";

import * as React from "react";
import type { Customer } from "@skerp/types";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@skerp/ui/components/dialog";

import {
  SectionLabel,
  Field,
  PartyCard,
  formatDate,
  formatCurrency,
  SkeletonBody,
} from "../_shared/dialog-parts";

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
  IconCircleCheckFilled,
  IconClockEdit,
} from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data?: Customer;
  isLoading?: boolean;
};

export default function CustomerDetailDialog({
  open,
  onOpenChange,
  data,
  isLoading,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] !max-w-[1000px] h-[90vh] !max-h-[90vh] gap-0 overflow-hidden rounded-lg p-0">
        {/* Header */}

        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconBuildingStore size={20} />
            </span>

            <div>
              <DialogTitle>Customer Details</DialogTitle>

              {!isLoading && data && (
                <div className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                  <IconCircleCheckFilled size={10} />
                  Active Profile
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
              <SectionLabel>Customer Overview</SectionLabel>

              <PartyCard
                label="Customer"
                name={data?.name}
                subtitle={data?.city?.name}
                colorClass="bg-blue-100 text-blue-700"
                icon={<IconUser size={15} />}
              />
            </div>

            <div className="mx-5 border-t" />

            {/* Customer Information */}

            <div className="px-5 py-5">
              <SectionLabel>Customer Information</SectionLabel>

              <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                <Field
                  label="Short Name"
                  value={data?.shortName}
                  icon={<IconId size={12} />}
                />

                <Field
                  label="PAN No"
                  value={data?.customerPAN}
                  icon={<IconId size={12} />}
                />

                <Field
                  label="GSTIN"
                  value={data?.gstNo}
                  icon={<IconId size={12} />}
                />

                <Field
                  label="Credit Limit"
                  value={formatCurrency(data?.creditLimit)}
                  icon={<IconCash size={12} />}
                />

                <Field
                  label="Late Payment %"
                  value={
                    data?.interestRateLatePayment != null
                      ? `${data.interestRateLatePayment}%`
                      : "-"
                  }
                  icon={<IconPercentage size={12} />}
                />

                <Field
                  label="TDS %"
                  value={
                    data?.tdsDeductionRate != null
                      ? `${data.tdsDeductionRate}%`
                      : "-"
                  }
                  icon={<IconPercentage size={12} />}
                />

                <Field
                  label="Country"
                  value={data?.country}
                  icon={<IconMapPin size={12} />}
                />

                <Field
                  label="State"
                  value={data?.state?.name}
                  icon={<IconMapPin size={12} />}
                />

                <Field
                  label="City"
                  value={data?.city?.name}
                  icon={<IconMapPin size={12} />}
                />

                <Field
                  label="Contact Person"
                  value={data?.contactPerson}
                  icon={<IconUser size={12} />}
                />

                <Field
                  label="Contact Phone"
                  value={data?.contactPhone}
                  icon={<IconPhone size={12} />}
                />

                <Field
                  label="Mobile No"
                  value={data?.mobileNo}
                  icon={<IconPhone size={12} />}
                />

                <Field
                  label="Email"
                  value={data?.primaryEmail}
                  icon={<IconMail size={12} />}
                />

                <Field
                  label="Website"
                  value={data?.website}
                  icon={<IconWorld size={12} />}
                />

                <Field
                  label="Booking Restriction"
                  value={data?.disallowNewLRBooking ? "Yes" : "No"}
                  icon={<IconBan size={12} />}
                />

                <Field
                  label="Address"
                  value={data?.address}
                  icon={<IconHome size={12} />}
                />
              </div>
            </div>

            <div className="mx-5 border-t" />

            {/* System */}

            <div className="px-5 py-5">
              <SectionLabel>System Information</SectionLabel>

              <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                <Field
                  label="Created At"
                  value={formatDate(data?.createdAt)}
                  icon={<IconCalendar size={12} />}
                />

                <Field
                  label="Updated At"
                  value={formatDate(data?.updatedAt)}
                  icon={<IconClockEdit size={12} />}
                />
              </div>
            </div>
          </div>
        )}

        {/* Footer */}

        <div className="flex items-center justify-between border-t bg-muted/30 px-5 py-3">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <IconClockEdit size={12} />
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
