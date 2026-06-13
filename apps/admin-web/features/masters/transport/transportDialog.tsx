"use client";

import * as React from "react";
import type { Transport } from "@skerp/types";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";

import {
  IconBuildingWarehouse,
  IconHash,
  IconMapPin,
  IconPhone,
  IconTruck,
  IconWorld,
} from "@tabler/icons-react";

import {
  Field,
  SkeletonBody,
} from "../_shared/dialog-parts";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data?: Transport;
  isLoading?: boolean;
};

type RelationName = {
  id?: string;
  name?: string | null;
};

type TransportDetail = Transport & {
  id?: string;
  name?: string | null;
  phoneNo?: string | null;
  country?: string | null;
  stateId?: string | null;
  cityId?: string | null;
  state?: RelationName | null;
  city?: RelationName | null;
};

const display = (value?: React.ReactNode) => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return value;
};

export default function TransportDetailDialog({
  open,
  onOpenChange,
  data,
  isLoading,
}: Props) {
  const transport = data as TransportDetail | undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] w-[98vw] max-w-none overflow-hidden p-0 sm:max-w-[900px]">
        <div className="border-b bg-gradient-to-r from-muted/70 to-background px-6 py-5">
          <DialogHeader>
            <div className="flex items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
                <IconTruck size={24} />
              </span>

              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate text-xl font-semibold">
                  Transport Detail
                </DialogTitle>

                <DialogDescription>
                  Basic transport and location information
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="max-h-[calc(92vh-112px)] overflow-y-auto p-6">
          {isLoading ? (
            <SkeletonBody />
          ) : (
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-3">
              <Field
                icon={<IconTruck size={12} />}
                label="Transport Name"
                value={display(transport?.name)}
              />

              <Field
                icon={<IconPhone size={12} />}
                label="Mobile Number"
                value={display(transport?.phoneNo)}
              />

              <Field
                icon={<IconWorld size={12} />}
                label="Country"
                value={display(transport?.country)}
              />

              <Field
                icon={<IconBuildingWarehouse size={12} />}
                label="State"
                value={display(transport?.state?.name)}
              />

              <Field
                icon={<IconMapPin size={12} />}
                label="City"
                value={display(transport?.city?.name)}
              />

      
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}