"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  IconBuildingCommunity,
  IconMapPin,
  IconCircleCheckFilled,
  IconClockEdit,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { cityApi } from "./city.service";
import { cityKeys } from "./city.keys";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  cityId: string | null;
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
      <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </div>

      <div className="break-words text-sm font-semibold leading-6 text-foreground">
        {value || "-"}
      </div>
    </div>
  );
}

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

export default function CityDetailDialog({
  open,
  onOpenChange,
  cityId,
}: Props) {
  const cityDetail = useQuery({
    queryKey: cityId ? cityKeys.detail(cityId) : ["city-detail-empty"],
    queryFn: () => cityApi.detail(cityId!),
    enabled: open && Boolean(cityId),
  });

  const data = cityDetail.data;
  const isLoading = cityDetail.isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] !max-w-[620px] max-h-[90vh] gap-0 overflow-hidden rounded-lg p-0">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconBuildingCommunity size={20} />
            </span>

            <div>
              <DialogTitle>City Details</DialogTitle>
              {!isLoading && data && (
                <div className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                  <IconCircleCheckFilled size={10} />
                  Active City
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="max-h-[calc(90vh-112px)] overflow-y-auto px-5 py-5">
          {isLoading ? (
            <div className="grid gap-4">
              {Array.from({ length: 2 }).map((_, index) => (
                <Skeleton key={index} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid gap-x-8 gap-y-0 sm:grid-cols-2">
              <DetailItem
                icon={<IconBuildingCommunity size={14} />}
                label="City Name"
                value={data?.name}
              />

              <DetailItem
                icon={<IconMapPin size={14} />}
                label="State"
                value={data?.state?.name}
              />
            </div>
          )}
        </div>

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