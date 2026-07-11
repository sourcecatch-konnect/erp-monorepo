"use client";

import * as React from "react";
import Link from "next/link";
import {
  Column,
  ColumnDef,
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
import { Input } from "@skerp/ui/components/input";
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@skerp/ui/components/pagination";
import {
  IconArrowsSort,
  IconBan,
  IconCircleCheck,
  IconDatabaseOff,
  IconDotsVertical,
  IconDownload,
  IconEdit,
  IconPlayerPlay,
  IconPlus,
  IconSortAscending,
  IconSortDescending,
  IconTrash,
  IconTruckDelivery,
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import {
  ClientCell,
  DriverLine,
  LegChip,
  RouteCell,
  timeAgo,
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
  onCancel: (trip: Trip) => void;
  onDelete: (trip: Trip) => void;
  canStart: boolean;
  canDispatch: boolean;
  canClose: boolean;
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
  counts: Record<string, number>;
  isLoading?: boolean;
  canDownloadPdf: boolean;
  onDownloadPdf: (trip: Trip) => void;
  onRowClick: (trip: Trip) => void;
};

const DELETE_ALLOWED_STATUSES = ["Planned", "Cancelled"] as const;

/**
 * Right-pinned cells sit over scrolled content, so they need an opaque
 * background. Hover/header tints elsewhere are translucent over `bg-card`,
 * so the pinned equivalents pre-mix the same tint with the card color.
 */
const PIN_HEAD_BG = "bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))]";
const PIN_CELL_BG =
  "bg-card group-hover/row:bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))]";

const pinStyle = (
  column: Column<Trip, unknown>,
): React.CSSProperties | undefined =>
  column.getIsPinned() === "right"
    ? {
        right: column.getAfter("right"),
        width: column.getSize(),
        minWidth: column.getSize(),
      }
    : undefined;

function SortHeader({
  label,
  field,
  sort,
  onSortChange,
}: {
  label: string;
  field: string;
  sort: string;
  onSortChange: (value: string) => void;
}) {
  const [activeField, direction] = sort.split(":");
  const active = activeField === field;
  const Icon = active
    ? direction === "asc"
      ? IconSortAscending
      : IconSortDescending
    : IconArrowsSort;
  return (
    <button
      type="button"
      onClick={() =>
        onSortChange(
          active
            ? `${field}:${direction === "desc" ? "asc" : "desc"}`
            : `${field}:desc`,
        )
      }
      className={cn(
        "inline-flex cursor-pointer items-center gap-1 uppercase transition-colors hover:text-foreground",
        active && "text-foreground",
      )}
    >
      {label}
      <Icon size={13} className={active ? undefined : "opacity-50"} />
    </button>
  );
}

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
    counts,
    isLoading,
    onStart,
    onDispatch,
    onClose,
    onCancel,
    onDelete,
    canStart,
    canDispatch,
    canClose,
    canUpdate,
    canCancel,
    canDelete,
    canDownloadPdf,
    onDownloadPdf,
    onRowClick,
  } = props;

  const searchInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCtrlF = event.ctrlKey && event.key.toLowerCase() === "f";
      const isMetaF = event.metaKey && event.key.toLowerCase() === "f";

      if (!isCtrlF && !isMetaF) return;

      event.preventDefault();

      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

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
          const iso = row.original.startDateTime ?? row.original.createdAt;
          return (
            <div>
              <span className="block text-sm">{formatDate(iso)}</span>
              <span className="block text-xs text-muted-foreground">
                {timeAgo(iso)}
              </span>
            </div>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        size: 120,
        cell: ({ row }) => {
          const km = tripKmRun(row.original);
          return (
            <div className="flex flex-col items-start gap-0.5">
              <TripStatusBadge status={row.original.status} />
              {row.original.status === "Closed" && km !== null ? (
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
        size: 150,
        cell: ({ row }) => {
          const t = row.original;
          // LR trips carrying goods dispatch by attaching an LR; DC and
          // empty legs have no LR to attach and dispatch directly.
          const attachableLR = tripAttachesLR(t);
          const dispatchableDirect = tripDispatchesDirect(t);
          const closeable = t.status === "InTransit";
          const editable = t.status === "Planned";
          // Journey legs keep their chain slot — cancel, never delete.
          const deletable =
            !t.journeyId &&
            DELETE_ALLOWED_STATUSES.includes(
              t.status as (typeof DELETE_ALLOWED_STATUSES)[number],
            );
          const cancellable = t.status === "Planned" || t.status === "InTransit";
          const hasMenuAction =
            (canUpdate && editable) ||
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
                  className="h-7 px-2 text-xs"
                  onClick={() => onStart(t)}
                >
                  <IconTruckDelivery size={14} className="mr-1" /> Start
                </Button>
              ) : null}
              {canDispatch && dispatchableDirect ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={() => onDispatch(t)}
                >
                  <IconPlayerPlay size={14} className="mr-1" /> Dispatch
                </Button>
              ) : null}
              {canClose && closeable ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={() => onClose(t)}
                >
                  <IconCircleCheck size={14} className="mr-1" /> Close
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
      canUpdate,
      canCancel,
      canDelete,
      canDownloadPdf,
      onStart,
      onDispatch,
      onClose,
      onCancel,
      onDelete,
      onDownloadPdf,
    ],
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: { columnPinning: { right: ["status", "actions"] } },
  });

  const pageCount = Math.max(1, Math.ceil(total / size));
  const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

  return (
    <div className="w-full space-y-3">
      {/* Status tabs */}
      <div className="flex flex-wrap items-center gap-1">
        {TRIP_STATUS_ORDER.map((tab) => {
          const active = statusFilter === tab.key;
          const count = counts[tab.key];
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onStatusFilterChange(tab.key)}
              className={`cursor-pointer rounded-sm px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {tab.label}
              {typeof count === "number" ? (
                <span
                  className={`ml-1.5 rounded-sm px-1 text-xs ${
                    active
                      ? "bg-primary-foreground/20"
                      : "bg-muted-foreground/10"
                  }`}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:max-w-sm">
          <Input
            ref={searchInputRef}
            placeholder="Search trip no. or vehicle no..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pr-16"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex">
            <span>Ctrl</span>
            <IconPlus size={10} />
            <span>F</span>
          </kbd>
        </div>

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
                {table.getAllLeafColumns().map((col) => {
                  const pinned = col.getIsPinned() === "right";
                  return (
                    <TableCell
                      key={col.id}
                      style={pinStyle(col)}
                      className={cn(
                        "h-14",
                        pinned && `sticky z-10 ${PIN_CELL_BG}`,
                        col.id === "status" && "border-l border-border",
                      )}
                    >
                      <Skeleton
                        className={cn(
                          "h-4",
                          SKELETON_WIDTHS[col.id] ?? "w-24",
                        )}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="py-14 text-center text-muted-foreground"
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                    <IconDatabaseOff size={18} />
                  </div>
                  <span className="text-sm font-medium">No trips found</span>
                </div>
              </TableCell>
            </TableRow>
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
                        "h-14 text-sm",
                        pinned && `sticky z-10 ${PIN_CELL_BG} transition-colors`,
                        cell.column.id === "status" &&
                          "border-l border-border",
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

      <div className="flex flex-col gap-3 border-t px-1 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>
            {total === 0
              ? "Showing 0"
              : `Showing ${page * size + 1}-${Math.min((page + 1) * size, total)}`}{" "}
            of {total}
          </span>

          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <Select
              value={String(size)}
              onValueChange={(v) => onSizeChange(Number(v))}
            >
              <SelectTrigger size="sm" className="h-8 w-[72px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <span>
            Page {page + 1} of {pageCount}
          </span>
        </div>

        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                aria-disabled={page === 0}
                className={page === 0 ? "pointer-events-none opacity-50" : ""}
                onClick={(e) => {
                  e.preventDefault();
                  if (page > 0) onPageChange(page - 1);
                }}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                aria-disabled={page + 1 >= pageCount}
                className={
                  page + 1 >= pageCount ? "pointer-events-none opacity-50" : ""
                }
                onClick={(e) => {
                  e.preventDefault();
                  if (page + 1 < pageCount) onPageChange(page + 1);
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
