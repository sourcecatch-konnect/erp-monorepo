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
import type { Trip } from "@skerp/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@skerp/ui/components/dropdown";
import {
  IconBan,
  IconBuilding,
  IconCalendar,
  IconCircleCheck,
  IconCurrencyRupee,
  IconDotsVertical,
  IconDownload,
  IconEdit,
  IconFileDescription,
  IconMapPin,
  IconPlayerPlay,
  IconRoute,
  IconTag,
  IconTrash,
  IconTruck,
  IconTruckDelivery,
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { formatPaise } from "@/lib/money";
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
  ClientCell,
  DriverLine,
  LegChip,
  RouteCell,
  timeAgo,
  TripCargoLine,
  TripStatusBadge,
  TripTypeChip,
  TRIP_STATUS_ORDER,
  tripAttachesLR,
  tripDispatchesDirect,
  tripKmRun,
  VehiclePlate,
} from "./trip-ui";

export type TripRowActions = {
  /** Planned trip — routes to the Instant LR form to start (attach) the trip. */
  onStart: (trip: Trip) => void;
  /** Planned empty/DC leg — dispatches without an LR. */
  onDispatch: (trip: Trip) => void;
  /** InTransit trip — opens the closing-KM dialog. */
  onClose: (trip: Trip) => void;
  /** Closed trip — opens the limited, audited correction dialog. */
  onCorrect: (trip: Trip) => void;
  onCancel: (trip: Trip) => void;
  onDelete: (trip: Trip) => void;
  canStart: boolean;
  canDispatch: boolean;
  canClose: boolean;
  canCorrect: boolean;
  canUpdate: boolean;
  canCancel: boolean;
  canDelete: boolean;
};

type Props = TripRowActions & {
  data: Trip[];
  total: number;
  page: number;
  size: number;
  onPageChange: (page: number) => void;
  onSizeChange: (size: number) => void;
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
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
  canDownloadPdf: boolean;
  onDownloadPdf: (trip: Trip) => void;
  onRowClick: (trip: Trip) => void;
};

const DELETE_ALLOWED_STATUSES = ["Planned", "Cancelled"] as const;

/**
 * The reorderable columns, in default order. Only Status/Actions sit outside
 * the user's control — they stay pinned right.
 */
export const DEFAULT_TRIP_COLUMN_ORDER = [
  "trip",
  "journey",
  "vehicle",
  "route",
  "client",
  "type",
  "freight",
  "date",
] as const;

const COLUMN_META: ColumnMeta = {
  trip: { label: "Trip", icon: IconFileDescription },
  journey: { label: "Journey", icon: IconRoute },
  vehicle: { label: "Vehicle / Driver", icon: IconTruck },
  route: { label: "Route", icon: IconMapPin },
  client: { label: "Client", icon: IconBuilding },
  type: { label: "Type", icon: IconTag },
  freight: { label: "Freight", icon: IconCurrencyRupee },
  date: { label: "Date", icon: IconCalendar },
};

const SKELETON_WIDTHS: Record<string, string> = {
  trip: "w-32",
  journey: "w-20",
  vehicle: "w-24",
  route: "w-36",
  client: "w-28",
  type: "w-14",
  freight: "ml-auto w-16",
  date: "w-20",
  status: "w-20",
  actions: "ml-auto w-16",
};

export default function TripTable(props: Props) {
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
    typeFilter,
    onTypeFilterChange,
    sort,
    onSortChange,
    columnVisibility,
    onColumnVisibilityChange,
    columnOrder,
    onColumnOrderChange,
    counts,
    isLoading,
    onStart,
    onDispatch,
    onClose,
    onCorrect,
    onCancel,
    onDelete,
    canStart,
    canDispatch,
    canClose,
    canCorrect,
    canUpdate,
    canCancel,
    canDelete,
    canDownloadPdf,
    onDownloadPdf,
    onRowClick,
  } = props;

  const columns = React.useMemo<ColumnDef<Trip>[]>(
    () => [
      {
        id: "trip",
        header: "Trip",
        cell: ({ row }) => (
          <Link
            href={`/trips/${row.original.id}`}
            className="block"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="block font-medium text-primary hover:underline">
              {row.original.tripName}
            </span>
            <span className="block font-mono text-xs text-muted-foreground">
              {row.original.tripNumber}
            </span>
          </Link>
        ),
      },
      {
        id: "journey",
        header: "Journey",
        cell: ({ row }) => {
          const j = row.original.journey;
          if (!j) return <span className="text-muted-foreground">—</span>;
          return (
            <div className="space-y-0.5">
              <Link
                href={`/vehicle-journeys/${j.id}`}
                className="block text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {j.journeyNumber}
              </Link>
              <LegChip
                sequenceNo={row.original.sequenceNo}
                isReturnLeg={row.original.isReturnLeg}
              />
            </div>
          );
        },
      },
      {
        id: "vehicle",
        header: "Vehicle / Driver",
        cell: ({ row }) => (
          <div className="space-y-1">
            {row.original.vehicle ? (
              <VehiclePlate number={row.original.vehicle.vehicleNumber} />
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
            <DriverLine name={row.original.driver?.name} />
          </div>
        ),
      },
      {
        id: "route",
        header: "Route",
        cell: ({ row }) => (
          <RouteCell
            from={row.original.route?.sourceCity?.name}
            to={row.original.route?.destinationCity?.name}
          />
        ),
      },
      {
        id: "client",
        header: "Client",
        cell: ({ row }) => (
          <ClientCell
            name={row.original.consignor?.name}
            isTripEmpty={row.original.isTripEmpty}
          />
        ),
      },
      {
        id: "type",
        header: "Type",
        cell: ({ row }) => <TripTypeChip type={row.original.tripType} />,
      },
      {
        id: "freight",
        header: () => (
          <SortHeader
            label="Freight"
            field="onwardFreight"
            sort={sort}
            onSortChange={onSortChange}
          />
        ),
        cell: ({ row }) => {
          const paise = Number(row.original.onwardFreight);
          return (
            <div className="text-right font-medium tabular-nums">
              {paise > 0 ? (
                formatPaise(row.original.onwardFreight)
              ) : (
                <span className="font-normal text-muted-foreground">—</span>
              )}
            </div>
          );
        },
      },
      {
        id: "date",
        header: () => (
          <SortHeader
            label="Date"
            field="createdAt"
            sort={sort}
            onSortChange={onSortChange}
          />
        ),
        cell: ({ row }) => {
          const isPlanned = row.original.status === "Planned";
          // For a Planned trip, startDateTime isn't set yet — showing it
          // would fall back to createdAt (today) and look like a bogus
          // dispatch time. Show the actual planned time as primary instead.
          const iso = isPlanned
            ? (row.original.plannedStartDateTime ??
              row.original.startDateTime ??
              row.original.createdAt)
            : (row.original.startDateTime ?? row.original.createdAt);
          return (
            <div>
              <span className="block text-sm">
                {isPlanned ? "Planned " : ""}
                {formatDate(iso)}
              </span>
              <span className="block text-xs text-muted-foreground">
                {isPlanned ? `Created ${timeAgo(row.original.createdAt)}` : timeAgo(iso)}
              </span>
            </div>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        size: 112,
        enableHiding: false,
        cell: ({ row }) => {
          const t = row.original;
          const km = tripKmRun(t);
          return (
            <div className="flex flex-col items-start gap-0.5">
              <TripStatusBadge status={t.status} />
              <TripCargoLine trip={t} />
              {t.createdAs === "BACKFILLED_IN_TRANSIT" ? (
                <span className="pl-0.5 text-xs text-muted-foreground">
                  Back-filled
                </span>
              ) : null}
              {t.status === "Closed" && km !== null ? (
                <span className="pl-0.5 text-xs text-muted-foreground tabular-nums">
                  {km.toLocaleString("en-IN")} km
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => <span className="block text-right">Actions</span>,
        size: 136,
        enableHiding: false,
        cell: ({ row }) => {
          const t = row.original;
          // LR trips carrying goods dispatch by attaching an LR; DC and
          // empty legs have no LR to attach and dispatch directly.
          const attachableLR = tripAttachesLR(t);
          const dispatchableDirect = tripDispatchesDirect(t);
          const closeable = t.status === "InTransit";
          // Server-side "Way 1" gate: the final leg of an LR group cannot
          // close while its LRs are undelivered — a draft LR blocks too.
          const lrPending = (t.undeliveredLrCount ?? 0) > 0;
          const lrDraft = (t.lrSummary?.draft ?? 0) > 0;
          const editable = t.status === "Planned";
          const correctable = t.status === "Closed";
          // Journey legs keep their chain slot — cancel, never delete.
          const deletable =
            !t.journeyId &&
            DELETE_ALLOWED_STATUSES.includes(
              t.status as (typeof DELETE_ALLOWED_STATUSES)[number],
            );
          const cancellable =
            t.status === "Planned" || t.status === "InTransit";
          const hasMenuAction =
            (canUpdate && editable) ||
            (canCorrect && correctable) ||
            canDownloadPdf ||
            (canCancel && cancellable) ||
            (canDelete && deletable);
          return (
            <div
              className="flex items-center justify-end gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {canStart && attachableLR ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-1.5 text-xs"
                  onClick={() => onStart(t)}
                >
                  <IconTruckDelivery size={13} className="mr-1" /> Start
                </Button>
              ) : null}
              {canDispatch && dispatchableDirect ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-1.5 text-xs"
                  onClick={() => onDispatch(t)}
                >
                  <IconPlayerPlay size={13} className="mr-1" /> Dispatch
                </Button>
              ) : null}
              {canClose && closeable ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-1.5 text-xs"
                  disabled={lrPending}
                  title={
                    lrDraft
                      ? "The LR on this trip is still a draft — finalise and deliver it before closing"
                      : lrPending
                        ? "LRs on this trip are not delivered yet — mark them delivered or hold the group at hub"
                        : undefined
                  }
                  onClick={() => onClose(t)}
                >
                  <IconCircleCheck size={13} className="mr-1" /> Close
                </Button>
              ) : null}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Row actions"
                    disabled={!hasMenuAction}
                  >
                    <IconDotsVertical size={16} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {canUpdate && editable ? (
                    <DropdownMenuItem asChild>
                      <Link href={`/trips/${t.id}/edit`}>
                        <IconEdit size={16} className="mr-2" /> Edit
                      </Link>
                    </DropdownMenuItem>
                  ) : null}
                  {canCorrect && correctable ? (
                    <DropdownMenuItem onClick={() => onCorrect(t)}>
                      <IconEdit size={16} className="mr-2" /> Correct trip
                    </DropdownMenuItem>
                  ) : null}
                  {canDownloadPdf ? (
                    <DropdownMenuItem onClick={() => onDownloadPdf(t)}>
                      <IconDownload size={16} className="mr-2" /> Download PDF
                    </DropdownMenuItem>
                  ) : null}
                  {canCancel && cancellable ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => onCancel(t)}
                      >
                        <IconBan size={16} className="mr-2" /> Cancel
                      </DropdownMenuItem>
                    </>
                  ) : null}
                  {canDelete && deletable ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => onDelete(t)}
                      >
                        <IconTrash size={16} className="mr-2" /> Delete
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [
      sort,
      onSortChange,
      canStart,
      canDispatch,
      canClose,
      canCorrect,
      canUpdate,
      canCancel,
      canDelete,
      canDownloadPdf,
      onStart,
      onDispatch,
      onClose,
      onCorrect,
      onCancel,
      onDelete,
      onDownloadPdf,
    ],
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
        tabs={TRIP_STATUS_ORDER}
        active={statusFilter}
        onChange={onStatusFilterChange}
        counts={counts}
        layoutId="trips-status-tab"
      />

      <div className="flex flex-wrap items-center gap-2">
        <TableSearchInput
          value={search}
          onChange={onSearchChange}
          placeholder="Search trip no. or vehicle no..."
        />

        <Select value={typeFilter} onValueChange={onTypeFilterChange}>
          <SelectTrigger className="h-9 w-[150px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            <SelectItem value="lr">LR</SelectItem>
            <SelectItem value="dc">Rake (DC)</SelectItem>
          </SelectContent>
        </Select>

        <ColumnPickerPopover
          columnOrder={columnOrder}
          onColumnOrderChange={onColumnOrderChange}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={onColumnVisibilityChange}
          columnMeta={COLUMN_META}
          defaultOrder={DEFAULT_TRIP_COLUMN_ORDER}
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
                      h.column.id === "freight" && "text-right",
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
              message="No trips found"
            />
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="group/row cursor-pointer"
                onClick={() => onRowClick(row.original)}
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
