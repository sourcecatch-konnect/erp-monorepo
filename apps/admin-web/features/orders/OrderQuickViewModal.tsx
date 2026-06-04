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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value ?? "—"}</dd>
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isLoading ? "Order" : order?.orderNumber}
            {order ? <StatusBadge status={order.status} /> : null}
          </DialogTitle>
        </DialogHeader>

        {isLoading || !order ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Row label="Customer" value={order.customer?.name} />
              <Row
                label="Route"
                value={`${order.fromBranch?.shortCode ?? ""} → ${order.toBranch?.shortCode ?? ""}`}
              />
              <Row label="Pickup date" value={formatDate(order.pickupDate)} />
              <Row
                label="Type"
                value={
                  order.orderType === "Truck"
                    ? `${order.truckQuantity ?? ""} × ${order.vehicleType?.name ?? "Truck"}`
                    : "Item / Goods"
                }
              />
              <Row label="Freight" value={formatMoney(order.bookingFreightAmount)} />
              <Row
                label="Pickup location"
                value={
                  order.customerLocation?.name ??
                  order.pickupAddressOverride ??
                  "—"
                }
              />
            </section>

            {order.orderType === "Item" && order.items?.length ? (
              <section className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-xs uppercase">Goods</TableHead>
                      <TableHead className="text-xs uppercase">Qty</TableHead>
                      <TableHead className="text-xs uppercase">Unit</TableHead>
                      <TableHead className="text-xs uppercase">Weight</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.items.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell>{i.goods?.name ?? "—"}</TableCell>
                        <TableCell>{i.quantity}</TableCell>
                        <TableCell>{i.unit}</TableCell>
                        <TableCell>{i.weight ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </section>
            ) : null}

            {order.specialInstructions ? (
              <Row label="Instructions" value={order.specialInstructions} />
            ) : null}

            <div className="flex justify-end">
              <Button asChild variant="outline" size="sm">
                <Link href={`/orders/${order.id}`}>Open full detail →</Link>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
