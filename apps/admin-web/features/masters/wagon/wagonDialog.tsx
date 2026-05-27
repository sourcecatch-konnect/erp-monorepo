"use client";

import * as React from "react";
import type { Wagon } from "@skerp/types";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { Skeleton } from "@skerp/ui/components/skeleton";

import {
  IconTrain,
  IconRulerMeasure,
  IconScale,
} from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data?: Wagon;
  isLoading?: boolean;
};

function DetailItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 border-b py-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </div>

      <div className="break-words text-sm font-semibold leading-6 text-foreground">
        {value || "-"}
      </div>
    </div>
  );
}

export default function WagonDetailDialog({
  open,
  onOpenChange,
  data,
  isLoading,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] w-[98vw] max-w-none overflow-hidden p-0 sm:max-w-[850px]">
        <div className="border-b bg-muted/30 px-6 py-5">
          <DialogHeader>
            <div className="flex items-center gap-4">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <IconTrain size={22} />
              </span>

              <div>
                <DialogTitle className="text-lg font-semibold">
                  Wagon Detail
                </DialogTitle>
                <DialogDescription>
                  Complete wagon profile, dimensions and weight information
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="max-h-[calc(92vh-96px)] overflow-y-auto p-6">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full rounded-md" />
              ))}
            </div>
          ) : (
            <div className="grid gap-x-10 gap-y-0 md:grid-cols-2 xl:grid-cols-3">
              <DetailItem
                icon={<IconTrain size={15} />}
                label="Wagon Name"
                value={data?.name}
              />

              <DetailItem
                icon={<IconRulerMeasure size={15} />}
                label="Height"
                value={data?.height}
              />

              <DetailItem
                icon={<IconRulerMeasure size={15} />}
                label="Width"
                value={data?.width}
              />

              <DetailItem
                icon={<IconScale size={15} />}
                label="Weight"
                value={data?.weight}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}