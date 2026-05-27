"use client";

import type { Area } from "@skerp/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  IconMapPin,
  IconBuildingCommunity,
} from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data?: Area;
  isLoading?: boolean;
};

export default function AreaDetailDialog({
  open,
  onOpenChange,
  data,
  isLoading,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl overflow-hidden p-0">
        <div className="border-b bg-muted/20 px-5 py-4">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <IconMapPin size={20} />
              </span>

              <div>
                <DialogTitle className="text-base font-semibold">
                  Area Detail
                </DialogTitle>
                <DialogDescription>
                  Complete information about selected area
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="space-y-4 p-5">
          {isLoading ? (
            <>
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </>
          ) : (
            <>
              <div className="rounded-lg border bg-white p-4 shadow-sm">
                <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <IconMapPin size={14} />
                  Area Name
                </div>

                <p className="text-sm font-semibold text-foreground">
                  {data?.name ?? "-"}
                </p>
              </div>

              <div className="rounded-lg border bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <IconBuildingCommunity size={14} />
                  City
                </div>

                <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">
                  <IconBuildingCommunity size={13} />
                  {data?.city?.name ?? "-"}
                </span>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}