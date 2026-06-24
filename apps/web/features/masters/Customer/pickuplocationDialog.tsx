"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type { Customer } from "@skerp/types";
import { IconMapPin } from "@tabler/icons-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { Skeleton } from "@skerp/ui/components/skeleton";

import CustomerLocationsEditor from "./CustomerLocationsEditor";
import { cityApi } from "../city/city.service";
import { cityKeys } from "../city/city.keys";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  customer: Customer | null;
};

export default function CustomerPickupLocationDialog({
  open,
  onOpenChange,
  customer,
}: Props) {
  const cities = useQuery({
    queryKey: cityKeys.list({ page: 0, size: 1000 }),
    queryFn: () => cityApi.list({ page: 0, size: 1000 }),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
     <DialogContent className="flex max-h-[85vh] w-[95vw] !max-w-3xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b bg-muted/30 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <IconMapPin size={20} />
            </div>

            <div className="space-y-1">
              <DialogTitle className="text-lg font-semibold">
                Pickup Locations
              </DialogTitle>

              <DialogDescription>
                Add and manage pickup locations for{" "}
                <span className="font-medium text-foreground">
                  {customer?.name ?? "selected customer"}
                </span>
                .
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {!customer?.id ? (
            <p className="text-sm text-muted-foreground">
              Select a customer to manage pickup locations.
            </p>
          ) : cities.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          ) : (
            <CustomerLocationsEditor
              customerId={customer.id}
              cities={cities.data?.data ?? []}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}