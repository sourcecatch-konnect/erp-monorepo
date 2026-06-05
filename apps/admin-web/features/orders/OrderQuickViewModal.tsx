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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";

import { orderApi } from "./order.service";
import { orderKeys } from "./order.keys";
import { StatusBadge, formatDate, formatMoney } from "./order-ui";
import { IconArrowRight } from "@tabler/icons-react";

function DetailLine({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-start gap-3">
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
    queryKey: orderId ? orderKeys.detail(orderId) : ["order-detail-empty"],
    queryFn: () => orderApi.detail(orderId as string),
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
                <p className="truncate text-sm font-semibold">
                  {order.customer?.name ?? "—"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {order.fromBranch?.shortCode ?? "—"} →{" "}
                  {order.toBranch?.shortCode ?? "—"}
                </p>
              </div>

              <div className="shrink-0">
                <StatusBadge status={order.status} />
              </div>
            </div>

            <div className="space-y-3">
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
                value={formatMoney(order.bookingFreightAmount)}
              />

              <DetailLine
                label="Pickup"
                value={
                  order.customerLocation?.name ??
                  order.pickupAddressOverride ??
                  "—"
                }
              />

              {(order.contactPersonName ||
  order.contactMobile ||
  order.contactEmail) && (
  <div className="border-t pt-4">
    <p className="mb-3 text-sm font-semibold">Contact details</p>

    <div className="space-y-3">
      {order.contactPersonName ? (
        <DetailLine
          label="Person"
          value={order.contactPersonName}
        />
      ) : null}

      {order.contactMobile ? (
        <DetailLine
          label="Mobile"
          value={order.contactMobile}
        />
      ) : null}

      {order.contactEmail ? (
        <DetailLine
          label="Email"
          value={order.contactEmail}
        />
      ) : null}
    </div>
  </div>
)}
            </div>

            {order.orderType === "Item" && order.items?.length ? (
              <div className="border-t pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold">Goods</p>
                  <p className="text-xs text-muted-foreground">
                    {order.items.length} item{order.items.length > 1 ? "s" : ""}
                  </p>
                </div>

                <div className="max-h-44 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="h-8 text-xs">Goods</TableHead>
                        <TableHead className="h-8 text-xs">Qty</TableHead>
                        <TableHead className="h-8 text-xs">Unit</TableHead>
                        <TableHead className="h-8 text-xs">Weight</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.items.map((i) => (
                        <TableRow key={i.id}>
                          <TableCell className="py-2">
                            {i.goods?.name ?? "—"}
                          </TableCell>
                          <TableCell className="py-2">{i.quantity}</TableCell>
                          <TableCell className="py-2">{i.unit}</TableCell>
                          <TableCell className="py-2">
                            {i.weight ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}

            {order.specialInstructions ? (
              <div className="border-t pt-4">
                <p className="mb-1 text-xs text-muted-foreground">
                  Instructions
                </p>
                <p className="text-sm leading-6">{order.specialInstructions}</p>
              </div>
            ) : null}

           <div className="flex justify-end border-t pt-4">
  <Button asChild size="sm">
    <Link
      href={`/orders/${order.id}`}
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