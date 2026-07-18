"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
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
  IconBuildingStore,
  IconBuildingWarehouse,
  IconCalendar,
  IconClipboardCheck,
  IconClockHour4,
  IconFileDescription,
  IconHash,
  IconLocation,
  IconMapPin,
  IconTruck,
  IconTruckDelivery,
  IconUser,
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { useTablePrefs } from "@/features/table-prefs";
import {
  ColumnPickerPopover,
  TableEmptyState,
  type ColumnMeta,
} from "@/components/data-table";
import {
  deliveryWorklistApi,
  deliveryWorklistKeys,
} from "./lorry-receipt.service";
import { daysSince, lrGroupDisplay } from "./lorry-receipt-ui";
import type {
  AtHubRow,
  PendingDeliveryRow,
  PendingPodRow,
  WorklistGroupRef,
} from "@skerp/types";

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

function AgeText({
  iso,
  overdueDays,
}: {
  iso: string | null;
  overdueDays: number;
}) {
  if (!iso) return <>—</>;
  const days = daysSince(iso);
  return (
    <span
      className={cn(
        "tabular-nums",
        days >= overdueDays && "font-semibold text-destructive",
      )}
    >
      {days} day{days === 1 ? "" : "s"}
    </span>
  );
}

function GroupLink({ id, label }: { id: string; label: string }) {
  return (
    <Link
      href={`/lorry-receipts/${encodeURIComponent(id)}`}
      className="font-medium text-primary hover:underline"
    >
      {label}
    </Link>
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

/**
 * One worklist tab: a plain (unpaginated) table with the shared column
 * picker; layout persists per user under `tableKey`.
 */
function WorklistTable<T>({
  tableKey,
  defaultOrder,
  columnMeta,
  columns,
  data,
  isLoading,
  emptyMessage,
}: {
  tableKey: string;
  defaultOrder: readonly string[];
  columnMeta: ColumnMeta;
  columns: ColumnDef<T>[];
  data: T[];
  isLoading: boolean;
  emptyMessage: string;
}) {
  const { columnVisibility, setColumnVisibility, columnOrder, setColumnOrder } =
    useTablePrefs(tableKey, defaultOrder);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: { columnVisibility, columnOrder },
  });

  const visibleColumnCount = table.getVisibleLeafColumns().length;

  return (
    <div className="space-y-2">
      <div className="flex">
        <ColumnPickerPopover
          columnOrder={columnOrder}
          onColumnOrderChange={setColumnOrder}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
          columnMeta={columnMeta}
          defaultOrder={defaultOrder}
        />
      </div>

      <Table className="bg-card">
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead
                  key={h.id}
                  className="h-10 whitespace-nowrap text-xs font-semibold uppercase text-muted-foreground"
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, r) => (
              <TableRow key={r}>
                {table.getVisibleLeafColumns().map((col) => (
                  <TableCell key={col.id} className="h-12">
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : data.length === 0 ? (
            <TableEmptyState
              colSpan={visibleColumnCount}
              message={emptyMessage}
            />
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="h-12 text-sm">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

/* ---------------- Pending delivery ---------------- */

const PENDING_DELIVERY_ORDER = [
  "lr",
  "group",
  "route",
  "consignee",
  "vehicle",
  "unloading",
  "age",
] as const;

const PENDING_DELIVERY_META: ColumnMeta = {
  lr: { label: "LR", icon: IconFileDescription },
  group: { label: "Group", icon: IconHash },
  route: { label: "Route", icon: IconMapPin },
  consignee: { label: "Consignee", icon: IconBuildingStore },
  vehicle: { label: "Vehicle", icon: IconTruck },
  unloading: { label: "Unloading point", icon: IconLocation },
  age: { label: "In transit", icon: IconClockHour4 },
};

const PENDING_DELIVERY_COLUMNS: ColumnDef<PendingDeliveryRow>[] = [
  {
    id: "lr",
    header: "LR",
    cell: ({ row }) => (
      <GroupLink id={row.original.lrNumber} label={row.original.lrNumber} />
    ),
  },
  {
    id: "group",
    header: "Group",
    cell: ({ row }) => row.original.group.groupNumber,
  },
  {
    id: "route",
    header: "Route",
    cell: ({ row }) => routeOf(row.original.group),
  },
  {
    id: "consignee",
    header: "Consignee",
    cell: ({ row }) => row.original.group.consignee?.name ?? "—",
  },
  {
    id: "vehicle",
    header: "Vehicle",
    cell: ({ row }) => vehicleOf(row.original.group),
  },
  {
    id: "unloading",
    header: "Unloading point",
    cell: ({ row }) => row.original.unloadingLocation?.name ?? "—",
  },
  {
    id: "age",
    header: "In transit",
    cell: ({ row }) => (
      <AgeText
        iso={row.original.group.finalisedAt}
        overdueDays={OVERDUE_DELIVERY_DAYS}
      />
    ),
  },
];

/* ---------------- At hub ---------------- */

const AT_HUB_ORDER = [
  "group",
  "lrs",
  "route",
  "consignee",
  "hub",
  "age",
] as const;

const AT_HUB_META: ColumnMeta = {
  group: { label: "LR / Group", icon: IconHash },
  lrs: { label: "LRs", icon: IconFileDescription },
  route: { label: "Route", icon: IconMapPin },
  consignee: { label: "Consignee", icon: IconBuildingStore },
  hub: { label: "Hub", icon: IconBuildingWarehouse },
  age: { label: "At hub for", icon: IconClockHour4 },
};

const AT_HUB_COLUMNS: ColumnDef<AtHubRow>[] = [
  {
    id: "group",
    header: "LR / Group",
    cell: ({ row }) => {
      const d = lrGroupDisplay(row.original);
      return (
        <div>
          <GroupLink id={row.original.id} label={d.title} />
          <span className="block text-xs text-muted-foreground">
            {d.subtitle}
          </span>
        </div>
      );
    },
  },
  {
    id: "lrs",
    header: "LRs",
    cell: ({ row }) =>
      row.original.lorryReceipts.map((lr) => lr.lrNumber).join(", "),
  },
  {
    id: "route",
    header: "Route",
    cell: ({ row }) =>
      `${row.original.originBranch?.name ?? "—"} → ${row.original.destinationBranch?.name ?? "—"}`,
  },
  {
    id: "consignee",
    header: "Consignee",
    cell: ({ row }) => row.original.consignee?.name ?? "—",
  },
  {
    id: "hub",
    header: "Hub",
    cell: ({ row }) => row.original.hub?.name ?? "—",
  },
  {
    id: "age",
    header: "At hub for",
    cell: ({ row }) => (
      <AgeText iso={row.original.hubArrivalAt} overdueDays={OVERDUE_HUB_DAYS} />
    ),
  },
];

/* ---------------- Pending POD ---------------- */

const PENDING_POD_ORDER = [
  "lr",
  "group",
  "route",
  "consignee",
  "delivered",
  "receiver",
  "age",
] as const;

const PENDING_POD_META: ColumnMeta = {
  lr: { label: "LR", icon: IconFileDescription },
  group: { label: "Group", icon: IconHash },
  route: { label: "Route", icon: IconMapPin },
  consignee: { label: "Consignee", icon: IconBuildingStore },
  delivered: { label: "Delivered", icon: IconCalendar },
  receiver: { label: "Receiver", icon: IconUser },
  age: { label: "POD pending", icon: IconClockHour4 },
};

const PENDING_POD_COLUMNS: ColumnDef<PendingPodRow>[] = [
  {
    id: "lr",
    header: "LR",
    cell: ({ row }) => (
      <GroupLink id={row.original.lrNumber} label={row.original.lrNumber} />
    ),
  },
  {
    id: "group",
    header: "Group",
    cell: ({ row }) => row.original.group.groupNumber,
  },
  {
    id: "route",
    header: "Route",
    cell: ({ row }) => routeOf(row.original.group),
  },
  {
    id: "consignee",
    header: "Consignee",
    cell: ({ row }) => row.original.group.consignee?.name ?? "—",
  },
  {
    id: "delivered",
    header: "Delivered",
    cell: ({ row }) =>
      row.original.delivery
        ? formatDate(row.original.delivery.deliveredAt)
        : "—",
  },
  {
    id: "receiver",
    header: "Receiver",
    cell: ({ row }) => row.original.delivery?.receiverName ?? "—",
  },
  {
    id: "age",
    header: "POD pending",
    cell: ({ row }) => (
      <AgeText
        iso={row.original.delivery?.deliveredAt ?? null}
        overdueDays={OVERDUE_POD_DAYS}
      />
    ),
  },
];

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
          <WorklistTable
            tableKey="deliveries-pending-delivery"
            defaultOrder={PENDING_DELIVERY_ORDER}
            columnMeta={PENDING_DELIVERY_META}
            columns={PENDING_DELIVERY_COLUMNS}
            data={pendingDelivery.data ?? []}
            isLoading={pendingDelivery.isLoading}
            emptyMessage="Nothing pending — every dispatched LR is delivered."
          />
        </TabsContent>

        <TabsContent value="at-hub">
          <WorklistTable
            tableKey="deliveries-at-hub"
            defaultOrder={AT_HUB_ORDER}
            columnMeta={AT_HUB_META}
            columns={AT_HUB_COLUMNS}
            data={atHub.data ?? []}
            isLoading={atHub.isLoading}
            emptyMessage="No groups lying at the hub."
          />
        </TabsContent>

        <TabsContent value="pending-pod">
          <WorklistTable
            tableKey="deliveries-pending-pod"
            defaultOrder={PENDING_POD_ORDER}
            columnMeta={PENDING_POD_META}
            columns={PENDING_POD_COLUMNS}
            data={pendingPod.data ?? []}
            isLoading={pendingPod.isLoading}
            emptyMessage="No PODs outstanding — everything delivered is acknowledged."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
