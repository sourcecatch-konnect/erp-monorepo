"use client";

import * as React from "react";
import Link from "next/link";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { Order } from "@skerp/types";
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
  IconCheck,
  IconX,
  IconBan,
  IconEdit,
  IconDatabaseOff,
} from "@tabler/icons-react";

import { StatusBadge, formatDate, formatMoney, STATUS_ORDER } from "./order-ui";

export type OrderRowActions = {
  onQuickView: (order: Order) => void;
  onApprove: (order: Order) => void;
  onReject: (order: Order) => void;
  onCancel: (order: Order) => void;
  canApprove: boolean;
  canReject: boolean;
  canCancel: boolean;
  canUpdate: boolean;
};

type Props = OrderRowActions & {
  data: Order[];
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

const routeLabel = (o: Order) =>
  `${o.fromBranch?.shortCode ?? "?"} → ${o.toBranch?.shortCode ?? "?"}`;

const typeLabel = (o: Order) =>
  o.orderType === "Truck"
    ? `${o.truckQuantity ?? ""} × ${o.vehicleType?.name ?? "Truck"}`.trim()
    : `Item (${o.items?.length ?? 0})`;

export default function OrderTable(props: Props) {
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
    onQuickView,
    onApprove,
    onReject,
    onCancel,
    canApprove,
    canReject,
    canCancel,
    canUpdate,
  } = props;

  const columns = React.useMemo<ColumnDef<Order>[]>(
    () => [
      {
        header: "Order No",
        accessorKey: "orderNumber",
        cell: ({ row }) => (
          <Link
            href={`/orders/${row.original.id}`}
            className="font-medium text-primary hover:underline"
          >
            {row.original.orderNumber}
          </Link>
        ),
      },
      {
        header: "Customer",
        cell: ({ row }) => row.original.customer?.name ?? "—",
      },
      { header: "Route", cell: ({ row }) => routeLabel(row.original) },
      { header: "Type", cell: ({ row }) => typeLabel(row.original) },
      {
        header: "Pickup",
        cell: ({ row }) => formatDate(row.original.pickupDate),
      },
      {
        header: "Freight",
        cell: ({ row }) => formatMoney(row.original.bookingFreightAmount),
      },
      {
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        header: "Created by",
        cell: ({ row }) =>
          row.original.createdBy
            ? `${row.original.createdBy.firstName} ${row.original.createdBy.lastName}`
            : "—",
      },
    ],
    [],
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
        {STATUS_ORDER.map((tab) => {
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
          placeholder="Search order no or customer…"
          className="h-9 max-w-xs"
        />
      </div>

      <div className="w-full overflow-x-auto rounded-lg  bg-card ">
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
                    <span className="text-sm font-medium">No orders found</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => {
                const o = row.original;
                const isPending = o.status === "PendingApproval";
                const cancellable =
                  o.status === "PendingApproval" || o.status === "Confirmed";
                const editable =
                  o.status === "PendingApproval" || o.status === "Rejected";
                return (
                  <TableRow key={row.id} className="hover:bg-muted/30">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="h-12 text-sm">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="w-16 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Quick view"
                          onClick={() => onQuickView(o)}
                        >
                          <IconEye size={16} />
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
                            {canApprove && isPending ? (
                              <DropdownMenuItem onClick={() => onApprove(o)}>
                                <IconCheck size={16} className="mr-2" /> Approve
                              </DropdownMenuItem>
                            ) : null}
                            {canReject && isPending ? (
                              <DropdownMenuItem onClick={() => onReject(o)}>
                                <IconX size={16} className="mr-2" /> Reject
                              </DropdownMenuItem>
                            ) : null}
                            {canUpdate && editable ? (
                              <DropdownMenuItem asChild>
                                <Link href={`/orders/${o.id}/edit`}>
                                  <IconEdit size={16} className="mr-2" /> Edit
                                </Link>
                              </DropdownMenuItem>
                            ) : null}
                            {canCancel && cancellable ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => onCancel(o)}
                                >
                                  <IconBan size={16} className="mr-2" /> Cancel
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
          {total} order{total === 1 ? "" : "s"} · page {page + 1} of {pageCount}
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
