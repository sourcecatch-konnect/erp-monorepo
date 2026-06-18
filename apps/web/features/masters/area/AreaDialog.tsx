"use client";

import type { Area } from "@skerp/types";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@skerp/ui/components/dialog";

import { SectionLabel, Field, SkeletonBody } from "../_shared/dialog-parts";

import {
  IconMapPin,
  IconBuildingCommunity,
  IconCircleCheckFilled,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { areaKeys } from "./area.key";
import { areaApi } from "./area.service";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  areaId: string | null;
};
export default function AreaDetailDialog({
  open,
  onOpenChange,
 areaId,
}: Props) {
  const areaDetail = useQuery({
    queryKey: areaId ? areaKeys.detail(areaId) : ["area-detail-empty"],
    queryFn: () => areaApi.detail(areaId!),
    enabled: open && Boolean(areaId),
  });

  const data = areaDetail.data;
  const isLoading = areaDetail.isLoading;

  const latitude = data?.latitude;
  const longitude = data?.longitude;
  const hasMapLocation =
    typeof latitude === "number" && typeof longitude === "number";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] !max-w-[700px] max-h-[90vh] gap-0 overflow-hidden rounded-2xl p-0">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconMapPin size={20} />
            </span>

            <div>
              <DialogTitle>Area Dialog</DialogTitle>

              {!isLoading && data && (
                <div className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                  <IconCircleCheckFilled size={10} />
                  Active Area
                </div>
              )}
            </div>
          </div>
        </div>

        {isLoading ? (
          <SkeletonBody />
        ) : (
          <div className="max-h-[calc(90vh-120px)] overflow-y-auto">
            <div className="mx-5 border-t" />

        <div className="px-5 py-5">
  <SectionLabel>Area Information</SectionLabel>

  <div className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
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

    <Field
      label="State"
      value={data?.city?.state?.name}
      icon={<IconBuildingCommunity size={12} />}
    />
  </div>
</div>

<div className="px-5 pb-5">
  <SectionLabel>Google Location</SectionLabel>

  {hasMapLocation ? (
  <div className="col-span-2 overflow-hidden rounded-lg border bg-muted/20">
    <div className="border-b px-3 py-2">
      <p className="text-sm font-medium">Location Preview</p>
      <p className="text-xs text-muted-foreground">
        Map preview based on the selected Google location
      </p>
    </div>

    <iframe
      title="Area location map"
      className="h-[220px] w-full border-0"
      loading="lazy"
      src={`https://www.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`}
    />
  </div>
) : null}
</div>
          </div>
        )}

        <div className="flex items-center justify-end border-t bg-muted/30 px-5 py-3">
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
