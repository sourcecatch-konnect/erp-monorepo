"use client";

import * as React from "react";
import type { Wagon } from "@skerp/types";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@skerp/ui/components/dialog";

import { Skeleton } from "@skerp/ui/components/skeleton";

import {
  SectionLabel,
  Field,
  SkeletonBody,
} from "../_shared/dialog-parts";

import {
  IconTrain,
  IconRulerMeasure,
  IconScale,
  IconCircleCheckFilled,
} from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data?: Wagon;
  isLoading?: boolean;
};


export default function WagonDetailDialog({
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
        className="w-[92vw] !max-w-[1000px] h-[50vh] !max-h-[90vh] gap-0 overflow-hidden rounded-2xl p-0"
      >
        {/* Header */}

        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconTrain size={20} />
            </span>

            <div>
            
              <DialogTitle>Wagon Details</DialogTitle>
              {!isLoading && data && (
                <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600">
                  <IconCircleCheckFilled size={10} />
                  Active Wagon
                </div>
              )}
            </div>
          </div>
        </div>

        {isLoading ? (
          <SkeletonBody />
        ) : (
          <div className="h-[calc(90vh-120px)] overflow-y-auto">

            {/* Wagon Information */}

            <div className="px-5 py-5">

              <SectionLabel>
                Wagon Information
              </SectionLabel>

              <div className="grid grid-cols-3 gap-x-6 gap-y-4">

                <Field
                  label="Wagon Name"
                  value={data?.name}
                  icon={<IconTrain size={12} />}
                />

                <Field
                  label="Height"
                  value={
                    data?.height != null
                      ? `${data.height} ft`
                      : "-"
                  }
                  icon={<IconRulerMeasure size={12} />}
                />

                <Field
                  label="Width"
                  value={
                    data?.width != null
                      ? `${data.width} ft`
                      : "-"
                  }
                  icon={<IconRulerMeasure size={12} />}
                />

                <Field
                  label="Weight"
                  value={
                    data?.weight != null
                      ? `${data.weight} kg`
                      : "-"
                  }
                  icon={<IconScale size={12} />}
                />

              </div>

            </div>

            <div className="mx-5 border-t" />

            {/* System Information */}

       
          </div>
        )}

        {/* Footer */}

        <div className="flex items-center justify-between border-t bg-muted/30 px-5 py-3">

    

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