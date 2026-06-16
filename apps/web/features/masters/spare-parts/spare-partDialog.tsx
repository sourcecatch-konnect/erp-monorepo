"use client";

import * as React from "react";
import type { SparePart } from "@skerp/types";

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
  formatCurrencyFromPaise,
  SkeletonBody,
} from "../_shared/dialog-parts";

import {
  IconTool,
  IconCategory,
  IconPackage,
  IconCurrencyRupee,
  IconFileText,
  IconCalendar,
  IconRecycle,
  IconStack,
  IconTruck,
  IconCircleCheckFilled,
  IconClockEdit,
} from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data?: SparePart;
  isLoading?: boolean;
};

export default function SparePartDetailDialog({
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
              <IconTool size={20} />
            </span>

            <div>
              <DialogTitle>Spare Part Details</DialogTitle>
              {!isLoading && data && (
                <div className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                  <IconCircleCheckFilled size={10} />
                  Active Record
                </div>
              )}
            </div>
          </div>
        </div>

        {isLoading ? (
          <SkeletonBody />
        ) : (
          <div className="h-[calc(90vh-120px)] overflow-y-auto">
            {/* Basic Information */}

            <div className="px-5 py-5">
              <SectionLabel>Basic Information</SectionLabel>

              <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                <Field
                  label="Part Name"
                  value={data?.name}
                  icon={<IconTool size={12} />}
                />

                <Field
                  label="Type"
                  value={data?.type}
                  icon={<IconCategory size={12} />}
                />

                <Field
                  label="Category"
                  value={data?.category?.name}
                  icon={<IconCategory size={12} />}
                />

                <Field
                  label="Unit"
                  value={data?.unit}
                  icon={<IconPackage size={12} />}
                />

  <Field
  label="Rate Per Unit"
  value={
    data?.rate != null
      ? `${formatCurrencyFromPaise(data.rate)} / ${data?.unit ?? "unit"}`
      : "-"
  }
  icon={<IconCurrencyRupee size={12} />}
/>

<Field
  label="Minimum Stock Qty"
  value={
    data?.minimumStock != null
      ? `${data.minimumStock} ${data?.unit ?? ""}`
      : "-"
  }
  icon={<IconStack size={12} />}
/>

<Field
  label="Minimum Stock Amount"
  value={
    data?.rate != null && data?.minimumStock != null
      ? formatCurrencyFromPaise(data.rate * data.minimumStock)
      : "-"
  }
  icon={<IconCurrencyRupee size={12} />}
/>

                <Field
                  label="Supplier"
                  value={data?.supplier?.name}
                  icon={<IconTruck size={12} />}
                />

                <Field
                  label="Recyclable"
                  value={data?.isRecyclable ? "Yes" : "No"}
                  icon={<IconRecycle size={12} />}
                />

                <Field
                  label="Batch Tracked"
                  value={data?.isBatchTracked ? "Yes" : "No"}
                  icon={<IconStack size={12} />}
                />

                <Field
                  label="Description"
                  value={data?.description}
                  icon={<IconFileText size={12} />}
                />
              </div>
            </div>

            <div className="mx-5 border-t" />

            {/* System Information */}

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
