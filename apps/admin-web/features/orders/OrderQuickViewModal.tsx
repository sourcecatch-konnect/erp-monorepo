"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";


import { orderApi } from "./order.service";
import { orderKeys } from "./order.keys";
import { StatusBadge, formatDate, formatMoneyFromPaise } from "./order-ui";
import { IconArrowRight, IconBuildingWarehouse } from "@tabler/icons-react";

function DetailLine({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
<div className="space-y-1">
  <p className="text-xs text-muted-foreground">{label}</p>
  <p className="text-sm font-medium text-foreground">{value || "—"}</p>
</div>
  );
}

export default function OrderQuickViewModal({
  orderId,
  open,
  onOpenChange,
}: {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
const { data: order, isLoading } = useQuery({
  queryKey: orderId ? orderKeys.quickView(orderId) : ["order-quick-empty"],
  queryFn: () => orderApi.quickView(orderId as string),
  enabled: Boolean(open && orderId),
});
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base">
            {isLoading ? "Order quick view" : order?.orderNumber}
          </DialogTitle>
        </DialogHeader>

        {isLoading || !order ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4 border-b pb-4">
        <div className="min-w-0">
  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
    Customer
  </p>

  <p className="mt-1 truncate text-base font-semibold text-foreground">
    {order.customer?.name ?? "—"}
  </p>

  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
    <div className="flex h-7 w-7 items-center justify-center rounded-md border bg-background">
      <IconBuildingWarehouse size={15} />
    </div>

    <span className="font-medium text-foreground">
      {order.fromBranch?.shortCode ?? "—"}
    </span>

    <IconArrowRight size={14} className="text-muted-foreground" />

    <span className="font-medium text-foreground">
      {order.toBranch?.shortCode ?? "—"}
    </span>
  </div>
</div>

              <div className="shrink-0">
                <StatusBadge status={order.status} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
  <DetailLine
    label="Pickup date"
    value={formatDate(order.pickupDate)}
  />

  <DetailLine
    label="Order type"
    value={
      order.orderType === "Truck"
        ? `${order.truckQuantity ?? 1} × ${
            order.vehicleType?.name ?? "Truck"
          }`
        : "Item / Goods"
    }
  />

  <DetailLine
    label="Freight"
    value={formatMoneyFromPaise(order.bookingFreightAmount)}
  />

  <DetailLine
    label="Pickup"
    value={
      order.customerLocation?.name ??
      order.pickupAddressOverride ??
      "—"
    }
  />
</div>

{(order.contactPersonName || order.contactMobile || order.contactEmail) && (
  <div className="border-t pt-4">
    <p className="mb-3 text-sm font-semibold">Contact details</p>

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {order.contactPersonName && (
        <DetailLine label="Person" value={order.contactPersonName} />
      )}

      {order.contactMobile && (
        <DetailLine label="Mobile" value={order.contactMobile} />
      )}

      {order.contactEmail && (
        <DetailLine label="Email" value={order.contactEmail} />
      )}
    </div>
  </div>
)}

         

           <div className="flex justify-end border-t pt-4">
  <Button asChild size="sm">
    <Link
    href={`/orders/${encodeURIComponent(order.orderNumber)}`}
      className="group flex items-center gap-2"
    >
      Open full detail
      <IconArrowRight
        size={16}
        className="transition-transform group-hover:translate-x-1"
      />
    </Link>
  </Button>
</div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
