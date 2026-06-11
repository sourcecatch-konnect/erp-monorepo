"use client";

import type { Area } from "@skerp/types";

import {
  Dialog,
  DialogContent,
} from "@skerp/ui/components/dialog";
import { Skeleton } from "@skerp/ui/components/skeleton";

import {
  SectionLabel,
  Field,
} from "../_shared/dialog-parts";

import {
  IconMapPin,
  IconBuildingCommunity,
  IconCircleCheckFilled,
} from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data?: Area;
  isLoading?: boolean;
};

function SkeletonBody() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <Skeleton className="mb-3 h-4 w-28" />
        <Skeleton className="h-20 rounded-lg" />
      </div>

      <div>
        <Skeleton className="mb-3 h-4 w-28" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-14 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AreaDetailDialog({
  open,
  onOpenChange,
  data,
  isLoading,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] !max-w-[700px] max-h-[90vh] gap-0 overflow-hidden rounded-lg p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconMapPin size={20} />
            </span>

            <div>
              <p className="text-sm font-semibold">Area Details</p>

              {!isLoading && data && (
                <div className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                  <IconCircleCheckFilled size={10} />
                  Active Area
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        {isLoading ? (
          <SkeletonBody />
        ) : (
          <div className="max-h-[calc(90vh-120px)] overflow-y-auto">


            <div className="mx-5 border-t" />

            <div className="px-5 py-5">
              <SectionLabel>Area Information</SectionLabel>

              <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <Field
                  label="Area Name"
                  value={data?.name}
                  icon={<IconMapPin size={12} />}
                />

                <Field
                  label="City"
                  value={data?.city?.name}
                  icon={<IconBuildingCommunity size={12} />}
                />

     
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t bg-muted/30 px-5 py-3">


          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg border px-4 py-1.5 text-xs hover:bg-muted"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}