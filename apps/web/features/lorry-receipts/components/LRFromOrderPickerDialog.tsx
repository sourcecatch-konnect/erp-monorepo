"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { IconSearch, IconArrowRight, IconTruck, IconDatabaseOff } from "@tabler/icons-react";

import { Input } from "@skerp/ui/components/input";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@skerp/ui/components/dialog";

import { lrLookups, lrLookupKeys } from "../lorry-receipt.service";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function LRFromOrderPickerDialog({ open, onOpenChange }: Props) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");

  const orders = useQuery({
    queryKey: lrLookupKeys.confirmedTruckOrders,
    queryFn: lrLookups.confirmedTruckOrders,
    enabled: open,
  });

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders.data ?? [];
    return (orders.data ?? []).filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        (o.customer?.name ?? "").toLowerCase().includes(q)
    );
  }, [orders.data, search]);

  const handleSelect = (orderId: string) => {
    onOpenChange(false);
    router.push(`/lorry-receipts/new?orderId=${orderId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create LR from Order</DialogTitle>
          <DialogDescription>
            Select a confirmed truck order to create a lorry receipt against it.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <IconSearch
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order number or customer…"
            className="h-9 pl-9"
            autoFocus
          />
        </div>

        <div className="max-h-80 overflow-y-auto space-y-1 py-1">
          {orders.isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg p-2.5">
                <Skeleton className="h-8 w-8 rounded-md" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                <IconDatabaseOff size={18} />
              </div>
              <span className="text-sm">
                {search ? "No orders match your search" : "No confirmed truck orders found"}
              </span>
            </div>
          ) : (
            filtered.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => handleSelect(order.id)}
                className="group flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-muted/60"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40">
                  <IconTruck size={15} className="text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium leading-tight">{order.orderNumber}</p>
                    {order.truckQuantity != null && (
                      <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {order.truckQuantity} truck{order.truckQuantity !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {order.customer?.name ?? "—"}


                  </p>
                </div>
                <IconArrowRight
                  size={15}
                  className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                />
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
