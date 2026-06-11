"use client";

import * as React from "react";
import type { State } from "@skerp/types";

import {
  Dialog,
  DialogContent,
} from "@skerp/ui/components/dialog";
import { Skeleton } from "@skerp/ui/components/skeleton";

import {
  SectionLabel,
  PartyCard,
  formatDate,
} from "../_shared/dialog-parts";

import {
  IconMapPin,
  IconCircleCheckFilled,
  IconClockEdit,
} from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data?: State;
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
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className="h-14 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function StateDetailDialog({
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
              <p className="text-sm font-semibold">State Details</p>

              {!isLoading && data && (
                <div className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                  <IconCircleCheckFilled size={10} />
                  Active State
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
            <div className="px-5 py-5">
              <SectionLabel>State Overview</SectionLabel>

              <PartyCard
                label="State"
                name={data?.name}
                subtitle="State master information"
                colorClass="bg-violet-100 text-violet-700"
                icon={<IconMapPin size={15} />}
              />
            </div>

            <div className="mx-5 border-t" />

          
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
            className="rounded-lg border px-4 py-1.5 text-xs hover:bg-muted"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}