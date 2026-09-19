"use client";

import * as React from "react";
import Link from "next/link";
import {
  ColumnDef,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { VehicleJourney } from "@skerp/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  IconCoins,
  IconCalendar,
  IconEye,
  IconMapPin,
  IconRoad,
  IconRoute,
  IconTruck,
  IconUser,
  IconX,
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import {
  ColumnPickerPopover,
  PIN_CELL_BG,
  PIN_HEAD_BG,
  SortHeader,
  StatusTabs,
  TableEmptyState,
  TablePaginationFooter,
  TableSearchInput,
  pinStyle,
  type ColumnMeta,
} from "@/components/data-table";
import {
  JourneyStatusBadge,
  JOURNEY_STATUS_ORDER,
  SETTLEMENT_LABELS,
  formatDateTime,
} from "./journey-ui";
import { Popover, PopoverContent, PopoverTrigger } from "@skerp/ui/components/popver";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@skerp/ui/components/tooltip";
const getRouteCities = (journey: VehicleJourney): string[] => {
  const cities: string[] = [];

  if (journey.startCity?.name) {
    cities.push(journey.startCity.name);
  }

  for (const trip of journey.trips ?? []) {
    if (trip.toCity?.name) {
      cities.push(trip.toCity.name);
    }
  }

  return cities;
};
function DriverNameCell({ name }: { name?: string | null }) {
  if (!name) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="block w-40 cursor-default truncate text-sm">
            {name}
          </span>
        </TooltipTrigger>

        <TooltipContent side="top" className="max-w-xs">
          <p className="break-words">{name}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
function RouteChainPopover({
  journey,
}: {
  journey: VehicleJourney;
}) {
  const cities = getRouteCities(journey);
  const visibleCities = cities.slice(0, 2);
  const remainingCount = Math.max(cities.length - 2, 0);

  if (cities.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  if (remainingCount === 0) {
    return (
      <span className="whitespace-nowrap text-sm">
        {cities.join(" → ")}
      </span>
    );
  }

  return (
    <div
      className="flex items-center gap-1 whitespace-nowrap"
      onClick={(event) => event.stopPropagation()}
    >
      <span className="text-sm">
        {visibleCities.join(" → ")}
      </span>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-primary hover:bg-muted/80"
          >
            +{remainingCount} more
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          className="w-72 p-0"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="border-b px-4 py-3">
            <p className="text-sm font-semibold">Complete Route Chain</p>

            <p className="text-xs text-muted-foreground">
              {cities.length} cities in this journey
            </p>
          </div>

          <div
            className="max-h-[min(420px,60vh)] overflow-y-auto overscroll-contain px-4 py-3"
            onWheel={(event) => event.stopPropagation()}
          >
            <ol className="relative border-l border-border">
              {cities.map((city, index) => {
                const isFirst = index === 0;
                const isLast = index === cities.length - 1;

                return (
                  <li
                    key={`${city}-${index}`}
                    className="relative pb-4 pl-5 last:pb-0"
                  >
                    <span
                      className={cn(
                        "absolute -left-[5px] top-1 size-2.5 rounded-full ring-2 ring-background",
                        isFirst && "bg-emerald-500",
                        isLast && "bg-red-500",
                        !isFirst && !isLast && "bg-blue-500",
                      )}
                    />

                    <p className="text-sm font-medium">{city}</p>

                    <p className="text-xs text-muted-foreground">
                      {isFirst
                        ? "Starting point"
                        : isLast
                          ? "Final destination"
                          : `Stop ${index}`}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
type Props = {
  data: VehicleJourney[];
  total: number;
  page: number;
  size: number;
  onPageChange: (page: number) => void;
  onSizeChange: (size: number) => void;
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  startedFrom: string;
  onStartedFromChange: (value: string) => void;
  startedTo: string;
  onStartedToChange: (value: string) => void;
  sort: string;
  onSortChange: (value: string) => void;
  columnVisibility: VisibilityState;
  onColumnVisibilityChange: React.Dispatch<
    React.SetStateAction<VisibilityState>
  >;
  columnOrder: string[];
  onColumnOrderChange: (order: string[]) => void;
  counts: Record<string, number>;
  isLoading?: boolean;

};

/**
 * The reorderable columns, in default order. Status/View stay pinned
 * right — outside the user's control.
 */
export const DEFAULT_JOURNEY_COLUMN_ORDER = [
  "journey",
  "startDate",
  "endDate",
  "vehicle",
  "driver",
  "route",
  "currentCity",
  "km",
  "settlement",
] as const;

const COLUMN_META: ColumnMeta = {
  journey: { label: "Journey", icon: IconRoute },
  startDate: { label: "Start date", icon: IconCalendar },
  endDate: { label: "End date", icon: IconCalendar },
  vehicle: { label: "Vehicle", icon: IconTruck },
  driver: { label: "Driver", icon: IconUser },
  route: { label: "Route chain", icon: IconMapPin },
  currentCity: { label: "Current city", icon: IconMapPin },
  km: { label: "KM", icon: IconRoad },
  settlement: { label: "Settlement", icon: IconCoins },
};

const SKELETON_WIDTHS: Record<string, string> = {
  journey: "w-28",
  startDate: "w-28",
  endDate: "w-28",
  vehicle: "w-24",
  driver: "w-24",
  route: "w-36",
  currentCity: "w-20",
  km: "w-20",
  settlement: "w-20",
  status: "w-24",
  actions: "ml-auto w-8",
};

/** "Jalgaon → Pune → Howrah" built from the journey's ordered legs. */
const routeChain = (j: VehicleJourney) => {
  const cities: string[] = [j.startCity?.name ?? "?"];
  for (const leg of j.trips ?? []) {
    if (leg.toCity?.name) cities.push(leg.toCity.name);
  }
  return cities.join(" → ");
};

const lastClosingKm = (j: VehicleJourney) => {
  const closed = (j.trips ?? []).filter((l) => l.closingKm !== null);
  const last = closed[closed.length - 1];
  return last?.closingKm ?? null;
};

export default function JourneyTable(props: Props) {
  const {
    data,
    total,
    page,
    size,
    onPageChange,
    onSizeChange,
    search,
    onSearchChange,
    statusFilter,
    onStatusFilterChange,
    startedFrom,
    onStartedFromChange,
    startedTo,
    onStartedToChange,
    sort,
    onSortChange,
    columnVisibility,
    onColumnVisibilityChange,
    columnOrder,
    onColumnOrderChange,
    counts,
    isLoading,
  } = props;

  const columns = React.useMemo<ColumnDef<VehicleJourney>[]>(
    () => [
      {
        id: "journey",
        header: () => (
          <SortHeader
            label="Journey"
            field="startedAt"
            sort={sort}
            onSortChange={onSortChange}
          />
        ),
        cell: ({ row }) => (
          <Link
            href={`/vehicle-journeys/${row.original.id}`}
            className="block"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="block font-medium text-primary hover:underline">
              {row.original.journeyNumber}
            </span>
          </Link>
        ),
      },
      {
        id: "startDate",
        header: () => (
          <SortHeader
            label="Start date"
            field="startedAt"
            sort={sort}
            onSortChange={onSortChange}
          />
        ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm">
            {formatDateTime(row.original.startedAt)}
          </span>
        ),
      },
      {
        id: "endDate",
        header: () => (
          <SortHeader
            label="End date"
            field="closedAt"
            sort={sort}
            onSortChange={onSortChange}
          />
        ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm">
            {row.original.closedAt
              ? formatDateTime(row.original.closedAt)
              : "—"}
          </span>
        ),
      },
      {
        id: "vehicle",
        header: "Vehicle",
        cell: ({ row }) => row.original.vehicle?.vehicleNumber ?? "—",
      },
      {
        id: "driver",
        header: "Driver",
        size: 180,
        cell: ({ row }) => (
          <DriverNameCell name={row.original.driver?.name} />
        ),
      },
      {
        id: "route",
        header: "Route chain",
        size: 260,
        cell: ({ row }) => (
          <RouteChainPopover journey={row.original} />
        ),
      },
      {
        id: "currentCity",
        header: "Current city",
        cell: ({ row }) => row.original.currentCity?.name ?? "—",
      },
      {
        id: "km",
        header: "KM",
        cell: ({ row }) => {
          const last = lastClosingKm(row.original);
          return (
            <span className="whitespace-nowrap text-sm tabular-nums">
              {row.original.openingKm}
              {last !== null ? ` → ${last}` : ""}
            </span>
          );
        },
      },
      {
        id: "settlement",
        header: "Settlement",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {SETTLEMENT_LABELS[row.original.settlementStatus]}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        size: 140,
        enableHiding: false,
        cell: ({ row }) => <JourneyStatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: () => <span className="block text-right">View</span>,
        size: 56,
        enableHiding: false,
        cell: ({ row }) => (
          <div
            className="flex items-center justify-end"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="View journey"
              asChild
            >
              <Link href={`/vehicle-journeys/${row.original.id}`}>
                <IconEye size={16} />
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    [sort, onSortChange],
  );

  // Pinned columns keep their slots regardless of the user's order.
  const tableColumnOrder = React.useMemo(
    () => [...columnOrder, "status", "actions"],
    [columnOrder],
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onColumnVisibilityChange,
    state: {
      columnPinning: { right: ["status", "actions"] },
      columnVisibility,
      columnOrder: tableColumnOrder,
    },
  });

  const visibleColumnCount = table.getVisibleLeafColumns().length;

  return (
    <div className="w-full space-y-3">
      <StatusTabs
        tabs={JOURNEY_STATUS_ORDER}
        active={statusFilter}
        onChange={onStatusFilterChange}
        counts={counts}
        layoutId="journeys-status-tab"
      />

      <div className="flex flex-wrap items-center gap-2">
        <TableSearchInput
          value={search}
          onChange={onSearchChange}
          placeholder="Search journey no., vehicle or driver..."
        />

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="whitespace-nowrap">Started from</span>
          <Input
            type="date"
            value={startedFrom}
            max={startedTo || undefined}
            onChange={(event) => onStartedFromChange(event.target.value)}
            className="h-9 w-36"
            aria-label="Journey started from date"
          />
        </label>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="whitespace-nowrap">Started to</span>
          <Input
            type="date"
            value={startedTo}
            min={startedFrom || undefined}
            onChange={(event) => onStartedToChange(event.target.value)}
            className="h-9 w-36"
            aria-label="Journey started to date"
          />
        </label>

        {startedFrom || startedTo ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onStartedFromChange("");
              onStartedToChange("");
            }}
          >
            <IconX size={14} className="mr-1" /> Clear dates
          </Button>
        ) : null}

        <ColumnPickerPopover
          columnOrder={columnOrder}
          onColumnOrderChange={onColumnOrderChange}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={onColumnVisibilityChange}
          columnMeta={COLUMN_META}
          defaultOrder={DEFAULT_JOURNEY_COLUMN_ORDER}
        />
      </div>

      <Table className="bg-card">
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => {
                const pinned = h.column.getIsPinned() === "right";
                return (
                  <TableHead
                    key={h.id}
                    style={pinStyle(h.column)}
                    className={cn(
                      "h-10 whitespace-nowrap text-xs font-semibold uppercase text-muted-foreground",
                      pinned && `sticky z-10 ${PIN_HEAD_BG}`,
                      h.column.id === "status" && "border-l border-border",
                    )}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 8 }).map((_, r) => (
              <TableRow key={r}>
                {table.getVisibleLeafColumns().map((col) => {
                  const pinned = col.getIsPinned() === "right";
                  return (
                    <TableCell
                      key={col.id}
                      style={pinStyle(col)}
                      className={cn(
                        "h-12",
                        pinned && `sticky z-10 ${PIN_CELL_BG}`,
                        col.id === "status" && "border-l border-border",
                      )}
                    >
                      <Skeleton
                        className={cn("h-4", SKELETON_WIDTHS[col.id] ?? "w-24")}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          ) : data.length === 0 ? (
            <TableEmptyState
              colSpan={visibleColumnCount}
              message="No journeys found"
            />
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="group/row cursor-pointer"

              >
                {row.getVisibleCells().map((cell) => {
                  const pinned = cell.column.getIsPinned() === "right";
                  return (
                    <TableCell
                      key={cell.id}
                      style={pinStyle(cell.column)}
                      className={cn(
                        "h-12 text-sm",
                        pinned &&
                        `sticky z-10 ${PIN_CELL_BG} transition-colors`,
                        cell.column.id === "status" && "border-l border-border",
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <TablePaginationFooter
        total={total}
        page={page}
        size={size}
        onPageChange={onPageChange}
        onSizeChange={onSizeChange}
      />
    </div>
  );
}
