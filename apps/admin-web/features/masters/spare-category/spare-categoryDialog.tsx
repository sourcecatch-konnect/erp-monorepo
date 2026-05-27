"use client";

import * as React from "react";
import type { SpareCategory } from "@skerp/types";

import {
  Dialog,
  DialogContent,
} from "@skerp/ui/components/dialog";

import { Skeleton } from "@skerp/ui/components/skeleton";

import {
  SectionLabel,
  Field,
  formatDate,
} from "../_shared/dialog-parts";

import {
  IconCategory,
  IconTag,
  IconFileInvoice,
  IconCircleCheckFilled,
  IconClockEdit,
  IconCalendar,
} from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data?: SpareCategory;
  isLoading?: boolean;
};

function SkeletonBody() {
  return (
    <div className="space-y-6 p-6">
      {Array.from({ length: 2 }).map((_, i) => (
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

export default function SpareCategoryDetailDialog({
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
        className="w-[92vw] !max-w-[850px] h-[75vh] !max-h-[75vh] gap-0 overflow-hidden rounded-2xl p-0"
      >

        {/* Header */}

        <div className="flex items-center justify-between border-b px-5 py-4">

          <div className="flex items-center gap-3">

            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconCategory size={20}/>
            </span>

            <div>
              <p className="text-sm font-semibold">
                Spare Category Details
              </p>

              {!isLoading && data && (
                <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600">
                  <IconCircleCheckFilled size={10}/>
                  Active Category
                </div>
              )}
            </div>

          </div>

        </div>

        {isLoading ? (
          <SkeletonBody/>
        ) : (
          <div className="h-[calc(75vh-120px)] overflow-y-auto">

            {/* Category Information */}

            <div className="px-5 py-5">

              <SectionLabel>
                Category Information
              </SectionLabel>

              <div className="grid grid-cols-3 gap-x-6 gap-y-4">

                <Field
                  label="Category Name"
                  value={data?.name}
                  icon={<IconCategory size={12}/>}
                />

                <Field
                  label="Category Type"
                  value={data?.type}
                  icon={<IconTag size={12}/>}
                />

                <Field
                  label="Ledger Name"
                  value={data?.ledgerName}
                  icon={<IconFileInvoice size={12}/>}
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

          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
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