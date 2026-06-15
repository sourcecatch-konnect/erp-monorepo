"use client";

import * as React from "react";
import Link from "next/link";
import {
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
  IconEye,
  IconDotsVertical,
  IconTruckDelivery,
  IconCircleCheck,
  IconBan,
  IconEdit,
  IconDatabaseOff,
  IconTrash,
} from "@tabler/icons-react";

import { formatMoney } from "@/lib/format";
import { TripStatusBadge, TRIP_STATUS_ORDER, TRIP_TYPE_LABELS } from "./trip-ui";

export type TripRowActions = {
  /** Planned trip — routes to the Instant LR form to start (attach) the trip. */
  onStart: (trip: Trip) => void;
  /** InTransit trip — opens the closing-KM dialog. */
  onClose: (trip: Trip) => void;
  onCancel: (trip: Trip) => void;
  onDelete: (trip: Trip) => void;
  canStart: boolean;
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
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  counts: Record<string, number>;
  isLoading?: boolean;
};

const DELETE_ALLOWED_STATUSES = ["Planned", "Cancelled"] as const;

const routeLabel = (t: Trip) =>
  `${t.route?.sourceCity?.name ?? "?"} → ${t.route?.destinationCity?.name ?? "?"}`;

export default function TripTable(props: Props) {
  const {
    data,
    total,
    page,
    size,
    onPageChange,
    search,
    onSearchChange,
    statusFilter,
    onStatusFilterChange,
    counts,
    isLoading,
    onStart,
    onClose,
    onCancel,
    onDelete,
    canStart,
    canClose,
    canUpdate,
    canCancel,
    canDelete,
  } = props;

  const columns = React.useMemo<ColumnDef<Trip>[]>(
    () => [
      {
        header: "Trip",
        cell: ({ row }) => (
          <Link href={`/trips/${row.original.id}`} className="block">
            <span className="block font-medium text-primary hover:underline">
              {row.original.tripName}
            </span>
            <span className="block text-xs text-muted-foreground">
              {row.original.tripNumber}
            </span>
          </Link>
        ),
      },
      {
        header: "Vehicle",
        cell: ({ row }) => row.original.vehicle?.vehicleNumber ?? "—",
      },
      { header: "Driver", cell: ({ row }) => row.original.driver?.name ?? "—" },
      { header: "Route", cell: ({ row }) => routeLabel(row.original) },
      {
        header: "Client",
        cell: ({ row }) => row.original.consignor?.name ?? "—",
      },
      {
        header: "Type",
        cell: ({ row }) => TRIP_TYPE_LABELS[row.original.tripType],
      },
      {
        header: "Freight",
        cell: ({ row }) => formatMoney(row.original.onwardFreight),
      },
      {
        header: "Status",
        cell: ({ row }) => <TripStatusBadge status={row.original.status} />,
      },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const pageCount = Math.max(1, Math.ceil(total / size));

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
              className={`rounded-sm px-3 py-1.5 text-sm transition-colors ${
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

      <div className="flex items-center justify-between gap-2">
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search trip no…"
          className="h-9 max-w-xs"
        />
      </div>

      <div className="w-full overflow-x-auto rounded-lg bg-card">
        <Table className="w-full">
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="bg-muted/40">
                {hg.headers.map((h) => (
                  <TableHead
                    key={h.id}
                    className="h-10 whitespace-nowrap text-xs font-semibold uppercase text-muted-foreground"
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
                <TableHead className="h-10 w-16 text-right text-xs font-semibold uppercase text-muted-foreground">
                  Actions
                </TableHead>
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, r) => (
                <TableRow key={r}>
                  {columns.map((_, c) => (
                    <TableCell key={c} className="h-12">
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                  <TableCell className="w-16">
                    <Skeleton className="ml-auto size-7 rounded-md" />
                  </TableCell>
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
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
              table.getRowModel().rows.map((row) => {
                const t = row.original;
                const startable = t.status === "Planned";
                const closeable = t.status === "InTransit";
                const editable = t.status === "Planned";
                const deletable = DELETE_ALLOWED_STATUSES.includes(
                  t.status as (typeof DELETE_ALLOWED_STATUSES)[number]
                );
                const cancellable =
                  t.status === "Planned" || t.status === "InTransit";
                return (
                  <TableRow key={row.id} className="hover:bg-muted/30">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="h-12 text-sm">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="w-16 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="View trip"
                          asChild
                        >
                          <Link href={`/trips/${t.id}`}>
                            <IconEye size={16} />
                          </Link>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label="Row actions"
                            >
                              <IconDotsVertical size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canStart && startable ? (
                              <DropdownMenuItem onClick={() => onStart(t)}>
                                <IconTruckDelivery size={16} className="mr-2" />{" "}
                                Start trip
                              </DropdownMenuItem>
                            ) : null}
                            {canClose && closeable ? (
                              <DropdownMenuItem onClick={() => onClose(t)}>
                                <IconCircleCheck size={16} className="mr-2" />{" "}
                                Close trip
                              </DropdownMenuItem>
                            ) : null}
                            {canUpdate && editable ? (
                              <DropdownMenuItem asChild>
                                <Link href={`/trips/${t.id}/edit`}>
                                  <IconEdit size={16} className="mr-2" /> Edit
                                </Link>
                              </DropdownMenuItem>
                            ) : null}
                            {canCancel && cancellable ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600"
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
                                  className="text-red-600"
                                  onClick={() => onDelete(t)}
                                >
                                  <IconTrash size={16} className="mr-2" />{" "}
                                  Delete
                                </DropdownMenuItem>
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {total} trip{total === 1 ? "" : "s"} · page {page + 1} of {pageCount}
        </p>
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
