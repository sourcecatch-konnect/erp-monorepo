"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@skerp/ui/components/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import {
  IconTruckDelivery,
  IconBuildingWarehouse,
  IconClipboardCheck,
  IconClockHour4,
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import {
  deliveryWorklistApi,
  deliveryWorklistKeys,
} from "./lorry-receipt.service";
import { daysSince } from "./lorry-receipt-ui";
import type { WorklistGroupRef } from "@skerp/types";

const OVERDUE_DELIVERY_DAYS = 7;
const OVERDUE_POD_DAYS = 7;
const OVERDUE_HUB_DAYS = 3;

const vehicleOf = (group: WorklistGroupRef) =>
  group.isMarketVehicle
    ? (group.marketVehicleNumber ?? "Market vehicle")
    : (group.secondaryTrip?.vehicle?.vehicleNumber ??
      group.primaryTrip?.vehicle?.vehicleNumber ??
      "—");

const routeOf = (group: WorklistGroupRef) =>
  `${group.originBranch?.name ?? "—"} → ${group.destinationBranch?.name ?? "—"}`;

function AgeCell({ iso, overdueDays }: { iso: string | null; overdueDays: number }) {
  if (!iso) return <TableCell>—</TableCell>;
  const days = daysSince(iso);
  return (
    <TableCell
      className={cn(
        "tabular-nums",
        days >= overdueDays && "font-semibold text-destructive",
      )}
    >
      {days} day{days === 1 ? "" : "s"}
    </TableCell>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  onClick,
  active,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card p-4 text-left transition-colors",
        onClick && "hover:bg-muted/40",
        active && "border-primary",
      )}
    >
      <Icon size={20} className="shrink-0 text-muted-foreground" />
      <div>
        <p className="text-lg font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </button>
  );
}

function RowSkeletons({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, r) => (
        <TableRow key={r}>
          {Array.from({ length: columns }).map((_, c) => (
            <TableCell key={c}>
              <Skeleton className="h-4 w-24" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

function EmptyRow({ columns, message }: { columns: number; message: string }) {
  return (
    <TableRow>
      <TableCell
        colSpan={columns}
        className="py-8 text-center text-sm text-muted-foreground"
      >
        {message}
      </TableCell>
    </TableRow>
  );
}

/**
 * Delivery worklists: pending delivery (fleet + market), lying at hub, and
 * POD not yet returned — each with aging and overdue highlighting. See
 * docs/LR_DELIVERY_ACK_PLAN.md §8.
 */
export default function DeliveriesPage() {
  const [tab, setTab] = React.useState("pending-delivery");

  const stats = useQuery({
    queryKey: deliveryWorklistKeys.stats,
    queryFn: deliveryWorklistApi.stats,
  });
  const pendingDelivery = useQuery({
    queryKey: deliveryWorklistKeys.pendingDelivery,
    queryFn: deliveryWorklistApi.pendingDelivery,
  });
  const atHub = useQuery({
    queryKey: deliveryWorklistKeys.atHub,
    queryFn: deliveryWorklistApi.atHub,
  });
  const pendingPod = useQuery({
    queryKey: deliveryWorklistKeys.pendingPod,
    queryFn: deliveryWorklistApi.pendingPod,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <div>
        <h1 className="text-lg font-semibold">Deliveries</h1>
        <p className="text-sm text-muted-foreground">
          Consignments awaiting delivery, lying at the hub, or with the signed
          POD still in the field.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pending delivery"
          value={stats.data?.pendingDelivery ?? "…"}
          icon={IconTruckDelivery}
          active={tab === "pending-delivery"}
          onClick={() => setTab("pending-delivery")}
        />
        <StatCard
          label="At hub"
          value={stats.data?.atHub ?? "…"}
          icon={IconBuildingWarehouse}
          active={tab === "at-hub"}
          onClick={() => setTab("at-hub")}
        />
        <StatCard
          label="Pending POD"
          value={stats.data?.pendingPod ?? "…"}
          icon={IconClipboardCheck}
          active={tab === "pending-pod"}
          onClick={() => setTab("pending-pod")}
        />
        <StatCard
          label="Avg delivery days (30d)"
          value={stats.data?.avgDeliveryDays ?? "—"}
          icon={IconClockHour4}
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending-delivery">Pending delivery</TabsTrigger>
          <TabsTrigger value="at-hub">At hub</TabsTrigger>
          <TabsTrigger value="pending-pod">Pending POD</TabsTrigger>
        </TabsList>

        <TabsContent value="pending-delivery">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>LR</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Consignee</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Unloading point</TableHead>
                  <TableHead>In transit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingDelivery.isLoading ? (
                  <RowSkeletons columns={7} />
                ) : (pendingDelivery.data ?? []).length === 0 ? (
                  <EmptyRow
                    columns={7}
                    message="Nothing pending — every dispatched LR is delivered."
                  />
                ) : (
                  (pendingDelivery.data ?? []).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Link
                          href={`/lorry-receipts/${row.group.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {row.lrNumber}
                        </Link>
                      </TableCell>
                      <TableCell>{row.group.groupNumber}</TableCell>
                      <TableCell>{routeOf(row.group)}</TableCell>
                      <TableCell>{row.group.consignee?.name ?? "—"}</TableCell>
                      <TableCell>{vehicleOf(row.group)}</TableCell>
                      <TableCell>{row.unloadingLocation?.name ?? "—"}</TableCell>
                      <AgeCell
                        iso={row.group.finalisedAt}
                        overdueDays={OVERDUE_DELIVERY_DAYS}
                      />
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="at-hub">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Group</TableHead>
                  <TableHead>LRs</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Consignee</TableHead>
                  <TableHead>Hub</TableHead>
                  <TableHead>At hub for</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {atHub.isLoading ? (
                  <RowSkeletons columns={6} />
                ) : (atHub.data ?? []).length === 0 ? (
                  <EmptyRow
                    columns={6}
                    message="No groups lying at the hub."
                  />
                ) : (
                  (atHub.data ?? []).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Link
                          href={`/lorry-receipts/${row.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {row.groupNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {row.lorryReceipts.map((lr) => lr.lrNumber).join(", ")}
                      </TableCell>
                      <TableCell>
                        {row.originBranch?.name ?? "—"} →{" "}
                        {row.destinationBranch?.name ?? "—"}
                      </TableCell>
                      <TableCell>{row.consignee?.name ?? "—"}</TableCell>
                      <TableCell>{row.hub?.name ?? "—"}</TableCell>
                      <AgeCell
                        iso={row.hubArrivalAt}
                        overdueDays={OVERDUE_HUB_DAYS}
                      />
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="pending-pod">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>LR</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Consignee</TableHead>
                  <TableHead>Delivered</TableHead>
                  <TableHead>Receiver</TableHead>
                  <TableHead>POD pending</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingPod.isLoading ? (
                  <RowSkeletons columns={7} />
                ) : (pendingPod.data ?? []).length === 0 ? (
                  <EmptyRow
                    columns={7}
                    message="No PODs outstanding — everything delivered is acknowledged."
                  />
                ) : (
                  (pendingPod.data ?? []).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Link
                          href={`/lorry-receipts/${row.group.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {row.lrNumber}
                        </Link>
                      </TableCell>
                      <TableCell>{row.group.groupNumber}</TableCell>
                      <TableCell>{routeOf(row.group)}</TableCell>
                      <TableCell>{row.group.consignee?.name ?? "—"}</TableCell>
                      <TableCell>
                        {row.delivery
                          ? new Date(
                              row.delivery.deliveredAt,
                            ).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell>{row.delivery?.receiverName ?? "—"}</TableCell>
                      <AgeCell
                        iso={row.delivery?.deliveredAt ?? null}
                        overdueDays={OVERDUE_POD_DAYS}
                      />
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
