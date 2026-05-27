"use client";

import * as React from "react";
import type { Goods } from "@skerp/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  IconBox,
  IconCategory,
  IconRulerMeasure,
  IconWeight,
  IconCalendar,
  IconHome,
  IconStack,
} from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data?: Goods;
  isLoading?: boolean;
};

function DetailItem({
  icon,
  label,
  value,
  wide = false,
}: {
  icon: React.ReactNode;
  label: string;
  value?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={
        wide
          ? "grid gap-1 border-b py-4 md:col-span-2 xl:col-span-3"
          : "grid gap-1 border-b py-4"
      }
    >
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

export default function GoodsDetailDialog({
  open,
  onOpenChange,
  data,
  isLoading,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] w-[98vw] max-w-none overflow-hidden p-0 sm:max-w-[1100px]">
        <div className="border-b bg-muted/30 px-6 py-5">
          <DialogHeader>
            <div className="flex items-center gap-4">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <IconBox size={22} />
              </span>

              <div>
                <DialogTitle className="text-lg font-semibold">
                  Goods Detail
                </DialogTitle>
                <DialogDescription>
                  Complete goods information, dimensions and storage details
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="max-h-[calc(92vh-96px)] overflow-y-auto p-6">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 15 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full rounded-md" />
              ))}
            </div>
          ) : (
            <div className="grid gap-x-10 gap-y-0 md:grid-cols-2 xl:grid-cols-3">
              <DetailItem
                icon={<IconBox size={15} />}
                label="Goods Name"
                value={data?.name}
              />

              <DetailItem
                icon={<IconCategory size={15} />}
                label="Category"
                value={data?.category}
              />

              <DetailItem
                icon={<IconWeight size={15} />}
                label="Weight"
                value={
                  data?.weight != null ? `${data.weight} kg` : "-"
                }
              />

              <DetailItem
                icon={<IconRulerMeasure size={15} />}
                label="Dimensions (L × W × H)"
                value={
                  data?.length != null ||
                  data?.width != null ||
                  data?.height != null
                    ? `${data.length ?? "-"} × ${data.width ?? "-"} × ${data.height ?? "-"}`
                    : "-"
                }
              />

              <DetailItem
                icon={<IconStack size={15} />}
                label="Storage Position"
                value={data?.storagePosition ?? "-"}
              />

              <DetailItem
                icon={<IconStack size={15} />}
                label="Storage Layer"
                value={data?.storageLayer ?? "-"}
              />

              <DetailItem
                icon={<IconStack size={15} />}
                label="Stacking Allowed"
                value={data?.isStackingAllowed ? "Yes" : "No"}
              />

              <DetailItem
                icon={<IconHome size={15} />}
                label="Description"
                value={data?.description ?? "-"}
                wide
              />

              <DetailItem
                icon={<IconCalendar size={15} />}
                label="Created At"
                value={
                  data?.createdAt
                    ? new Date(data.createdAt).toLocaleDateString()
                    : "-"
                }
              />

              <DetailItem
                icon={<IconCalendar size={15} />}
                label="Updated At"
                value={
                  data?.updatedAt
                    ? new Date(data.updatedAt).toLocaleDateString()
                    : "-"
                }
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}