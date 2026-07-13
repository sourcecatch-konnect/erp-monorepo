"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { IconArrowRight, IconMapPin, IconRoute } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { routeKeys } from "./route.key";
import { routeApi } from "./routes.service";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  id?: string | null;
};

function CityInfo({
  label,
  value,
  align = "left",
}: {
  label: string;
  value?: string | null;
  align?: "left" | "right";
}) {
  return (
    <div
      className={[
        "min-w-[110px] flex-1",
        align === "right" ? "text-right" : "text-left",
      ].join(" ")}
    >
      <div
        className={[
          "mb-1 flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
          align === "right" ? "justify-end" : "justify-start",
        ].join(" ")}
      >
        <IconMapPin size={13} className="shrink-0 text-primary" />
        {label}
      </div>

      <div className="truncate text-lg font-semibold text-foreground">
        {value || "-"}
      </div>
    </div>
  );
}
export default function RouteDetailDialog({
  open,
  onOpenChange,
  id,
}: Props) {
const routeDetail = useQuery({
  queryKey: id ? routeKeys.detail(id) : ["route-detail-empty"],
  queryFn: () => routeApi.detail(id!),
  enabled: Boolean(open && id),
});

const data = routeDetail.data;
  const fromCity = data?.sourceCity?.name ?? "-";
  const toCity = data?.destinationCity?.name ?? "-";
const isLoading = routeDetail.isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] overflow-hidden p-0 sm:w-[520px] sm:max-w-[520px]">
        <div className="border-b bg-muted/30 px-5 py-4">
          <DialogHeader>
            <div className="flex items-center gap-3 pr-8">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <IconRoute size={20} />
              </span>

              <div className="min-w-0">
                <DialogTitle className="text-base font-semibold">
                  Route Detail
                </DialogTitle>
                <DialogDescription>
                  From city and to city information
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="px-5 py-5">
          {isLoading ? (
            <div className="flex items-center gap-4">
              <Skeleton className="h-11 flex-1 rounded-md" />
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-11 flex-1 rounded-md" />
            </div>
          ) : (
            <div className="flex items-center gap-4 py-5 px-6">
              <CityInfo label="From City" value={fromCity} />

              <div className="flex shrink-0 items-center text-muted-foreground">
                <span className="h-px w-7 bg-border" />

                <span className="mx-2 flex size-8 items-center justify-center rounded-full bg-muted text-foreground">
                  <IconArrowRight size={16} />
                </span>

                <span className="h-px w-7 bg-border" />
              </div>

              <CityInfo label="To City" value={toCity} align="right" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}